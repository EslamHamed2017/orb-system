#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
COMPOSE_FILE=${COMPOSE_FILE:-compose.isolated-infrastructure.yml}
MC_IMAGE=cgr.dev/chainguard/minio-client:latest@sha256:10388d580a724f356b94c9b2631b5a179039cabe8c76e9b37d86ed007d569b05

free_port() { python3 - <<'PYPORT'
import socket
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PYPORT
}

export ORB_ISOLATED_DB_PASSWORD=${ORB_ISOLATED_DB_PASSWORD:-$(openssl rand -hex 24)}
export ORB_ISOLATED_MINIO_USER=${ORB_ISOLATED_MINIO_USER:-orbtest$(openssl rand -hex 6)}
export ORB_ISOLATED_MINIO_PASSWORD=${ORB_ISOLATED_MINIO_PASSWORD:-$(openssl rand -hex 24)}
export ORB_MIGRATION_DB_PORT=${ORB_MIGRATION_DB_PORT:-$(free_port)}
export ORB_RESTORE_DB_PORT=${ORB_RESTORE_DB_PORT:-$(free_port)}
export ORB_MIGRATION_OBJECT_PORT=${ORB_MIGRATION_OBJECT_PORT:-$(free_port)}
export ORB_RESTORE_OBJECT_PORT=${ORB_RESTORE_OBJECT_PORT:-$(free_port)}

compose=(docker compose -f "$COMPOSE_FILE")
cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait migration-postgres restore-postgres
"${compose[@]}" up -d migration-object-store restore-object-store

for port in "$ORB_MIGRATION_OBJECT_PORT" "$ORB_RESTORE_OBJECT_PORT"; do
  ready=0
  for _ in $(seq 1 60); do
    if curl --fail --silent "http://127.0.0.1:${port}/minio/health/ready" >/dev/null; then ready=1; break; fi
    sleep 1
  done
  [[ "$ready" == 1 ]] || { echo "object store on loopback port ${port} did not become ready" >&2; exit 2; }
done

export ORB_TEST_DATABASE_URL="postgresql://orb_migrator:${ORB_ISOLATED_DB_PASSWORD}@127.0.0.1:${ORB_MIGRATION_DB_PORT}/orb_migration?sslmode=disable"
restore_database_url="postgresql://orb_migrator:${ORB_ISOLATED_DB_PASSWORD}@127.0.0.1:${ORB_RESTORE_DB_PORT}/orb_restore?sslmode=disable"
node --test tests/integration/database/migrations.test.ts
DATABASE_URL="$restore_database_url" node node_modules/prisma/build/index.js migrate deploy

migration_history=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
restore_history=$("${compose[@]}" exec -T restore-postgres psql -U orb_migrator -d orb_restore -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
[[ "$migration_history" -gt 0 && "$migration_history" == "$restore_history" ]] || { echo "isolated database migration histories differ" >&2; exit 2; }

mc() {
  docker run --rm --interactive --network orb-isolated_backend \
    -e "MC_HOST_migration=http://${ORB_ISOLATED_MINIO_USER}:${ORB_ISOLATED_MINIO_PASSWORD}@migration-object-store:9000" \
    -e "MC_HOST_restore=http://${ORB_ISOLATED_MINIO_USER}:${ORB_ISOLATED_MINIO_PASSWORD}@restore-object-store:9000" \
    "$MC_IMAGE" "$@"
}
for alias in migration restore; do
  mc mb --ignore-existing --with-lock "${alias}/orb-evidence"
  mc version enable "${alias}/orb-evidence"
done
payload="$(openssl rand -hex 64)"
source_digest=$(printf '%s' "$payload" | sha256sum | cut -d' ' -f1)
printf '%s' "$payload" | mc pipe migration/orb-evidence/gate/payload.txt >/dev/null
if mc stat restore/orb-evidence/gate/payload.txt >/dev/null 2>&1; then
  echo "restore object store unexpectedly shares source data" >&2
  exit 2
fi
mc cp migration/orb-evidence/gate/payload.txt restore/orb-evidence/gate/payload.txt >/dev/null
restored_digest=$(mc cat restore/orb-evidence/gate/payload.txt | sha256sum | cut -d' ' -f1)
[[ "$source_digest" == "$restored_digest" ]] || { echo "restored object digest mismatch" >&2; exit 2; }

printf 'isolated infrastructure gate passed: migrations=%s; object_digest=%s\n' "$migration_history" "$restored_digest"
