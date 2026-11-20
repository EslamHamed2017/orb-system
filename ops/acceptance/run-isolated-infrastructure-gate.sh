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
work="$(mktemp -d)"
cleanup() { if ! "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1; then :; fi; rm -rf "$work"; }
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
DATABASE_URL="$ORB_TEST_DATABASE_URL" corepack pnpm prisma generate
node --test tests/integration/database/migrations.test.ts
DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/customers/customer-api-postgres.test.ts
DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/suppliers/supplier-api-postgres.test.ts
DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/products/product-api-postgres.test.ts
ORB_TEST_DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/projects/project-foundation-postgres.test.ts
ORB_TEST_DATABASE_URL="$ORB_TEST_DATABASE_URL" DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/projects/project-api-postgres.test.ts
DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/customers/customer-signin-postgres.test.ts
node --test tests/integration/suppliers/supplier-signin-postgres.test.ts
node --test tests/integration/concurrency/transaction-reference-postgres.test.ts
# Test fixtures intentionally reuse unique business codes. Recreate the disposable source,
# then migrate and seed the exact database that will be backed up.
"${compose[@]}" exec -T migration-postgres dropdb -U orb_migrator --force orb_migration
"${compose[@]}" exec -T migration-postgres createdb -U orb_migrator orb_migration
DATABASE_URL="$ORB_TEST_DATABASE_URL" node node_modules/prisma/build/index.js migrate deploy
DATABASE_URL="$ORB_TEST_DATABASE_URL" node prisma/seed.ts

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

# Daily-use trade flows: shipments and invoices (with real document upload to the locked bucket).
ORB_TEST_DATABASE_URL="$ORB_TEST_DATABASE_URL" node --test tests/integration/shipments/shipment-execution-postgres.test.ts
ORB_TEST_DATABASE_URL="$ORB_TEST_DATABASE_URL" OBJECT_STORAGE_ENDPOINT="http://127.0.0.1:${ORB_MIGRATION_OBJECT_PORT}" OBJECT_STORAGE_BUCKET=orb-evidence \
  OBJECT_STORAGE_ACCESS_KEY_ID="$ORB_ISOLATED_MINIO_USER" OBJECT_STORAGE_SECRET_ACCESS_KEY="$ORB_ISOLATED_MINIO_PASSWORD" \
  node --test tests/integration/invoices/invoices-postgres.test.ts tests/integration/money/money-postgres.test.ts tests/integration/profit/profit-postgres.test.ts

object_keys=("evidence/pilot-contract.txt" "reports/restore-marker.json")
printf 'ORB isolated evidence %s\n' "$(openssl rand -hex 32)" | mc pipe "migration/orb-evidence/${object_keys[0]}" >/dev/null
printf '{"gate":"T084","nonce":"%s"}\n' "$(openssl rand -hex 32)" | mc pipe "migration/orb-evidence/${object_keys[1]}" >/dev/null
mkdir -p "$work/object-snapshot" "$work/separate-copy" "$work/restored-objects"
: > "$work/object-integrity.source"
for key in "${object_keys[@]}"; do
  local_name=${key//\//__}
  mc cat "migration/orb-evidence/$key" > "$work/object-snapshot/$local_name"
  printf '%s  %s\n' "$(sha256sum "$work/object-snapshot/$local_name" | cut -d' ' -f1)" "$key" >> "$work/object-integrity.source"
done

# Create a real custom-format database backup and a separate object snapshot.
"${compose[@]}" exec -T migration-postgres pg_dump -U orb_migrator -d orb_migration \
  --format=custom --no-owner --no-privileges > "$work/database.dump"
tar --create --file="$work/objects.tar" --directory="$work/object-snapshot" .
(
  cd "$work"
  sha256sum database.dump objects.tar > manifest.sha256
)

# The disposable rehearsal still proves encrypted-at-rest backup handling without persisting its random key.
openssl rand -hex 32 > "$work/backup-encryption.key"
openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:"$work/backup-encryption.key" \
  -in "$work/database.dump" -out "$work/separate-copy/database.dump.enc"
openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:"$work/backup-encryption.key" \
  -in "$work/objects.tar" -out "$work/separate-copy/objects.tar.enc"
cp "$work/manifest.sha256" "$work/separate-copy/manifest.sha256"
rm -rf "$work/database.dump" "$work/objects.tar" "$work/object-snapshot"

openssl enc -d -aes-256-cbc -pbkdf2 -pass file:"$work/backup-encryption.key" \
  -in "$work/separate-copy/database.dump.enc" -out "$work/database.dump"
openssl enc -d -aes-256-cbc -pbkdf2 -pass file:"$work/backup-encryption.key" \
  -in "$work/separate-copy/objects.tar.enc" -out "$work/objects.tar"
(
  cd "$work"
  sha256sum --check separate-copy/manifest.sha256
)
tar --extract --file="$work/objects.tar" --directory="$work/restored-objects"

# Restore the database archive into a separate empty PostgreSQL service.
"${compose[@]}" exec -T restore-postgres pg_restore -U orb_migrator -d orb_restore \
  --exit-on-error --no-owner --no-privileges < "$work/database.dump"

# Restore the object snapshot into a separate versioned bucket.
for key in "${object_keys[@]}"; do
  local_name=${key//\//__}
  mc pipe "restore/orb-evidence/$key" < "$work/restored-objects/$local_name" >/dev/null
done

# Compare every public table by row count and canonical row digest, not only migration history.
database_integrity() {
  local service=$1 database=$2
  "${compose[@]}" exec -T "$service" psql -X -U orb_migrator -d "$database" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT format(
  'SELECT %L || ''|'' || count(*) || ''|'' || md5(COALESCE(string_agg(to_jsonb(t)::text, E''\\n'' ORDER BY to_jsonb(t)::text), '''')) FROM %I t;',
  tablename, tablename
) FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
\gexec
SQL
}
database_integrity migration-postgres orb_migration > "$work/database-integrity.source"
database_integrity restore-postgres orb_restore > "$work/database-integrity.restored"
cmp "$work/database-integrity.source" "$work/database-integrity.restored"

: > "$work/object-integrity.restored"
for key in "${object_keys[@]}"; do
  digest=$(mc cat "restore/orb-evidence/$key" | sha256sum | cut -d' ' -f1)
  printf '%s  %s\n' "$digest" "$key" >> "$work/object-integrity.restored"
done
cmp "$work/object-integrity.source" "$work/object-integrity.restored"

migration_history=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
restore_history=$("${compose[@]}" exec -T restore-postgres psql -U orb_migrator -d orb_restore -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
[[ "$migration_history" -gt 0 && "$migration_history" == "$restore_history" ]] || { echo "isolated database migration histories differ" >&2; exit 2; }

printf 'isolated backup/restore gate passed: migrations=%s; tables=%s; objects=%s; encrypted-copy=verified\n' \
  "$migration_history" "$(wc -l < "$work/database-integrity.restored")" "${#object_keys[@]}"
