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
ORB_TEST_MANAGED_SERVER=1 ORB_SUPPLIER_SHIPMENT_ACCEPTANCE=1 ORB_SALES_SHIPMENT_ACCEPTANCE=1 corepack pnpm exec playwright test tests/acceptance/supplier-shipment-persistence.spec.ts tests/acceptance/sales-shipment-persistence.spec.ts --project=chromium --workers=1 --retries=0
"${compose[@]}" exec -T migration-postgres psql -v ON_ERROR_STOP=1 -U orb_migrator -d orb_migration -c "DO \$guard\$ DECLARE bad uuid; got text; BEGIN SELECT id INTO bad FROM \"Contract\" WHERE kind='PURCHASE' LIMIT 1; BEGIN UPDATE \"SalesShipment\" SET sales_contract_id=bad WHERE project_id='33333333-3333-7333-8333-333333333333'; RAISE EXCEPTION 'project context guard accepted invalid contract'; EXCEPTION WHEN foreign_key_violation THEN NULL; END; END \$guard\$;"
"${compose[@]}" exec -T migration-postgres psql -v ON_ERROR_STOP=1 -U orb_migrator -d orb_migration -c "DO \$guard\$ DECLARE bad uuid; got text; BEGIN INSERT INTO \"Customer\" (id,tenant_id,reference,legal_name,email) SELECT orb_uuidv7(),tenant_id,'ORB-CUS-GUARD','Constraint Probe','constraint-probe@example.test' FROM \"Project\" WHERE id='33333333-3333-7333-8333-333333333333' RETURNING id INTO bad; BEGIN INSERT INTO \"SalesShipmentDataset\" SELECT (jsonb_populate_record(NULL::\"SalesShipmentDataset\",to_jsonb(d)||jsonb_build_object('id',orb_uuidv7(),'customer_id',bad,'revision_no',d.revision_no+100,'dataset_version',d.dataset_version+100))).* FROM \"SalesShipmentDataset\" d JOIN \"SalesShipment\" sh ON sh.id=d.shipment_id WHERE sh.project_id='33333333-3333-7333-8333-333333333333' LIMIT 1; RAISE EXCEPTION 'dataset context guard accepted invalid customer'; EXCEPTION WHEN foreign_key_violation THEN NULL; END; DELETE FROM \"Customer\" WHERE id=bad; END \$guard\$;"
count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc "SELECT count(*) FROM \"SupplierShipment\" WHERE \"project_id\"='33333333-3333-7333-8333-333333333333'")
sales_count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc "SELECT count(*) FROM \"SalesShipment\" WHERE \"project_id\"='33333333-3333-7333-8333-333333333333'")
sales_audit_count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc "SELECT count(*) FROM \"ProjectAuditEvent\" WHERE \"project_id\"='33333333-3333-7333-8333-333333333333' AND \"action\"='SALES_SHIPMENT_CREATED'")
sales_creator_count=$("${compose[@]}" exec -T migration-postgres psql -U orb_migrator -d orb_migration -Atc "SELECT count(*) FROM \"IdempotencyRecord\" WHERE \"operation_id\"='createSalesShipment' AND COALESCE(\"response_body\"#>>'{activeDataset,createdBy,userId}','')<>''")
[[ "$count" == 4 && "$sales_count" == 4 && "$sales_audit_count" == 4 && "$sales_creator_count" == 4 ]]
printf 'shipment persistence acceptance passed: chromium=10; workers=1; retries=0; PostgreSQL supplier rows=%s; sales rows=%s; audited=%s; attributed=%s; invalid-context guards=2; artifacts=8\n' "$count" "$sales_count" "$sales_audit_count" "$sales_creator_count"
