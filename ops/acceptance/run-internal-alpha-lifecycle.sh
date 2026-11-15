#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
COMPOSE_FILE=compose.isolated-infrastructure.yml
MC_IMAGE=cgr.dev/chainguard/minio-client:latest@sha256:10388d580a724f356b94c9b2631b5a179039cabe8c76e9b37d86ed007d569b05
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }
export ORB_ISOLATED_DB_PASSWORD="$(openssl rand -hex 24)"
export ORB_ISOLATED_MINIO_USER="orbtest$(openssl rand -hex 6)"
export ORB_ISOLATED_MINIO_PASSWORD="$(openssl rand -hex 24)"
export ORB_MIGRATION_DB_PORT="$(free_port)"
export ORB_RESTORE_DB_PORT="$(free_port)"
export ORB_MIGRATION_OBJECT_PORT="$(free_port)"
export ORB_RESTORE_OBJECT_PORT="$(free_port)"
compose=(docker compose -f "$COMPOSE_FILE")
cleanup() { ( set +e; "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 ); }
trap cleanup EXIT INT TERM
cleanup
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait migration-postgres
"${compose[@]}" up -d migration-object-store
for _ in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${ORB_MIGRATION_OBJECT_PORT}/minio/health/ready" >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent "http://127.0.0.1:${ORB_MIGRATION_OBJECT_PORT}/minio/health/ready" >/dev/null
export DATABASE_URL="postgresql://orb_migrator:${ORB_ISOLATED_DB_PASSWORD}@127.0.0.1:${ORB_MIGRATION_DB_PORT}/orb_migration?sslmode=disable"
corepack pnpm exec prisma migrate deploy
node prisma/seed.ts
mc() {
  docker run --rm --interactive --network orb-isolated_backend     -e "MC_HOST_alpha=http://${ORB_ISOLATED_MINIO_USER}:${ORB_ISOLATED_MINIO_PASSWORD}@migration-object-store:9000"     "$MC_IMAGE" "$@"
}
mc mb --ignore-existing --with-lock alpha/orb-evidence
mc version enable alpha/orb-evidence
marker="internal-alpha-$(openssl rand -hex 16)"
printf '%s' "$marker" | mc pipe alpha/orb-evidence/internal-alpha/lifecycle.txt >/dev/null
mc stat alpha/orb-evidence/internal-alpha/lifecycle.txt >/dev/null
project_count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc 'SELECT count(*) FROM "Project"')
[[ "$project_count" -gt 0 ]]
export NODE_ENV=production
export OBJECT_STORAGE_ENDPOINT="http://127.0.0.1:${ORB_MIGRATION_OBJECT_PORT}"
export OBJECT_STORAGE_REGION=us-east-1
export OBJECT_STORAGE_BUCKET=orb-evidence
export OBJECT_STORAGE_ACCESS_KEY_ID="$ORB_ISOLATED_MINIO_USER"
export OBJECT_STORAGE_SECRET_ACCESS_KEY="$ORB_ISOLATED_MINIO_PASSWORD"
export ORB_TEST_PORT="$(free_port)"
export ORB_TEST_BASE_URL="http://127.0.0.1:${ORB_TEST_PORT}"
export ORB_APP_ORIGIN="$ORB_TEST_BASE_URL"
export ORB_ALLOWED_ORIGINS="$ORB_TEST_BASE_URL"
export AUTH_IDLE_MINUTES=30 AUTH_ABSOLUTE_MINUTES=720
export ENCRYPTION_KEY_BASE64="$(openssl rand -base64 32)"
export TELEMETRY_ENDPOINT=http://127.0.0.1/telemetry
export BACKUP_STATUS_ENDPOINT=http://127.0.0.1/backup
export ORB_AUDIT_CHAIN_HEALTHY=1
corepack pnpm build
ORB_TEST_MANAGED_SERVER=1 corepack pnpm exec playwright test \
  tests/acceptance/internal-alpha-lifecycle.spec.ts \
  tests/acceptance/a17-project-sales-invoices.spec.ts \
  --project=chromium
final_project_count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc 'SELECT count(*) FROM "Project"')
[[ "$final_project_count" == "$project_count" ]]
mc stat alpha/orb-evidence/internal-alpha/lifecycle.txt >/dev/null
printf 'internal-alpha lifecycle passed: projects=%s; chromium=passed; object=versioned-and-readable\n' "$project_count"
