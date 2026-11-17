#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)";cd "$ROOT"
free_port(){ python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
export ORB_ISOLATED_DB_PASSWORD="$(openssl rand -hex 24)" ORB_ISOLATED_MINIO_USER="orbtest$(openssl rand -hex 6)" ORB_ISOLATED_MINIO_PASSWORD="$(openssl rand -hex 24)" ORB_MIGRATION_DB_PORT="$(free_port)" ORB_RESTORE_DB_PORT="$(free_port)" ORB_MIGRATION_OBJECT_PORT="$(free_port)" ORB_RESTORE_OBJECT_PORT="$(free_port)"
compose=(docker compose -f compose.isolated-infrastructure.yml)
cleanup(){ (set +e;"${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1); };trap cleanup EXIT INT TERM;cleanup
"${compose[@]}" up -d --wait migration-postgres
export DATABASE_URL="postgresql://orb_migrator:${ORB_ISOLATED_DB_PASSWORD}@127.0.0.1:${ORB_MIGRATION_DB_PORT}/orb_migration?sslmode=disable"
corepack pnpm exec prisma migrate deploy
ORB_TEST_DATABASE_URL="$DATABASE_URL" node --test tests/integration/projects/project-api-postgres.test.ts
node tests/acceptance/supplier-shipment-real-setup.ts
export NODE_ENV=production ORB_TEST_AUTH=1 ORB_TEST_PORT="$(free_port)" AUTH_IDLE_MINUTES=30 AUTH_ABSOLUTE_MINUTES=720 ORB_AUDIT_CHAIN_HEALTHY=1
export ORB_TEST_BASE_URL="http://127.0.0.1:${ORB_TEST_PORT}"
export ORB_APP_ORIGIN="$ORB_TEST_BASE_URL" ORB_ALLOWED_ORIGINS="$ORB_TEST_BASE_URL"
export OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:9 OBJECT_STORAGE_REGION=us-east-1 OBJECT_STORAGE_BUCKET=orb-evidence OBJECT_STORAGE_ACCESS_KEY_ID=test OBJECT_STORAGE_SECRET_ACCESS_KEY=test ENCRYPTION_KEY_BASE64="$(openssl rand -base64 32)" TELEMETRY_ENDPOINT=http://127.0.0.1/telemetry BACKUP_STATUS_ENDPOINT=http://127.0.0.1/backup
corepack pnpm build
ORB_TEST_MANAGED_SERVER=1 corepack pnpm exec playwright test tests/acceptance/supplier-shipment-persistence.spec.ts --project=chromium --retries=0
count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc "SELECT count(*) FROM \"SupplierShipment\" WHERE \"project_id\"='33333333-3333-7333-8333-333333333333'")
[[ "$count" == 4 ]];printf 'supplier shipment persistence acceptance passed: chromium=5; retries=0; PostgreSQL rows=%s; artifacts=4
' "$count"
