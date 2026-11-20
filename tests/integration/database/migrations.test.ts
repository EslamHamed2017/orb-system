import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import pg from "pg";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");
const MIGRATIONS = resolve(ROOT, "prisma/migrations");
const INITIAL = resolve(MIGRATIONS, "202611050001_r1_initial/migration.sql");
const EXPAND = resolve(MIGRATIONS, "202611110001_concept_realignment_expand/migration.sql");
const BACKFILL = resolve(MIGRATIONS, "202611110002_concept_realignment_backfill/migration.sql");
const PRODUCT_STATUS = resolve(MIGRATIONS, "202611110003_product_status_expand/migration.sql");
const CUTOVER = resolve(ROOT, "docs/runbooks/concept-realignment-cutover.md");
const LOCK = resolve(MIGRATIONS, "migration_lock.toml");
const PRISMA_CLI = resolve(ROOT, "node_modules/prisma/build/index.js");
const missing = [SCHEMA, INITIAL, EXPAND, BACKFILL, PRODUCT_STATUS, CUTOVER, LOCK].filter((path) => !existsSync(path));
const redReason = missing.length
  ? `ORB-R1-0202 migration artifacts are missing: ${missing.map((path) => path.slice(ROOT.length + 1)).join(", ")}`
  : undefined;

test("RED prerequisite: the complete ORB-R1-0202 migration artifact set exists", () => {
  assert.deepEqual(missing, [], redReason);
});

test("initial migration is PostgreSQL, substantive, declarative, and non-destructive", { skip: redReason }, () => {
  assert.match(readFileSync(LOCK, "utf8"), /^provider\s*=\s*["']postgresql["']/m);
  const sql = readFileSync(INITIAL, "utf8");
  assert.ok(sql.length > 10_000, "complete R1 migration cannot be a placeholder");
  assert.match(sql, /\bcreate\s+table\b/i);
  assert.match(sql, /\bcreate\s+type\b[^;]+\bas\s+enum\b/i);
  assert.match(sql, /\bforeign\s+key\b/i);
  assert.match(sql, /\b(?:check|unique)\s*\(/i);
  assert.doesNotMatch(sql, /\b(?:todo|fixme|placeholder|not\s+implemented)\b/i);
  assert.doesNotMatch(sql, /\b(?:drop\s+schema|drop\s+database)\b/i);
});

test("Prisma validates before database infrastructure is involved", { skip: redReason }, () => {
  assert.ok(existsSync(PRISMA_CLI), "installed Prisma CLI is required to validate ORB-R1-0202");
  const result = spawnSync(process.execPath, [PRISMA_CLI, "validate", "--schema", SCHEMA], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://orb_test:orb_test@127.0.0.1:5432/orb_test" },
  });
  assert.equal(result.status, 0, `prisma validate failed\n${result.stdout}${result.stderr}`);
});

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
test("fresh isolated PostgreSQL applies the complete migration", {
  skip: redReason || (!databaseUrl ? "ORB_TEST_DATABASE_URL not supplied; structural migration tests still run" : false),
}, () => {
  assert.match(databaseUrl!, /^postgres(?:ql)?:\/\//, "ORB_TEST_DATABASE_URL must be PostgreSQL");
  assert.ok(existsSync(PRISMA_CLI), "installed Prisma CLI is required to apply ORB-R1-0202");
  const result = spawnSync(process.execPath, [PRISMA_CLI, "migrate", "deploy", "--schema", SCHEMA], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: databaseUrl! }, timeout: 120_000,
  });
  assert.equal(result.status, 0, `fresh migrate deploy failed\n${result.stdout}${result.stderr}`);
});

test("legacy rows backfill 1:1 twice with stable v1 and v2 hashes and zero reconciliation deltas", {
  skip: redReason || (!databaseUrl ? "ORB_TEST_DATABASE_URL not supplied; real backfill test requires isolated PostgreSQL" : false),
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      INSERT INTO "User" (id, auth_subject, name_ar, name_en, locale, status, mfa_state, updated_at) VALUES
        ('00000000-0000-7000-8000-000000000001', 't018-user', 'مستخدم', 'User', 'en', 'ACTIVE', 'ENABLED', now());
      INSERT INTO "Party" (id, reference, legal_name_ar, legal_name_en, country_code, customer, supplier, status) VALUES
        ('00000000-0000-7000-8000-000000000002', 'T018-CUSTOMER', 'عميل', 'Customer', 'AE', true, false, 'ACTIVE'),
        ('00000000-0000-7000-8000-000000000003', 'T018-SUPPLIER', 'مورد', 'Supplier', 'BR', false, true, 'ACTIVE');
      INSERT INTO "CoffeeSpecification" (id, reference, origin, type, grade, crop_year, bag_type, standard_bag_weight, attributes) VALUES
        ('00000000-0000-7000-8000-000000000004', 'T018-COFFEE', 'Brazil', 'Arabica', 'A', '2026', 'JUTE', 60, '{}');
      INSERT INTO "Currency" (id, code, decimals, active) VALUES
        ('00000000-0000-7000-8000-000000000005', 'USD', 2, true);
      INSERT INTO "Project" (id, reference, customer_id, management_currency) VALUES
        ('00000000-0000-7000-8000-000000000006', 'T018-PROJECT', '00000000-0000-7000-8000-000000000002', 'USD');
      INSERT INTO "Contract" (id, project_id, kind, reference, counterparty_id, state) VALUES
        ('00000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000006', 'SALES', 'T018-SALES', '00000000-0000-7000-8000-000000000002', 'ACTIVE'),
        ('00000000-0000-7000-8000-000000000008', '00000000-0000-7000-8000-000000000006', 'PURCHASE', 'T018-PURCHASE', '00000000-0000-7000-8000-000000000003', 'ACTIVE');
      INSERT INTO "ContractVersion" (id, contract_id, revision_no, effective_date, coffee_specification_id, quantity, unit_price, currency, route, incoterm, named_place, payment_terms, document_terms, state) VALUES
        ('00000000-0000-7000-8000-000000000009', '00000000-0000-7000-8000-000000000007', 1, '2026-11-01', '00000000-0000-7000-8000-000000000004', 100, 12.5, 'USD', 'FOREIGN_TO_FOREIGN', 'FOB', 'Santos', 'NET30', 'STANDARD', 'APPROVED'),
        ('00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-000000000008', 1, '2026-11-01', '00000000-0000-7000-8000-000000000004', 100, 10, 'USD', 'FOREIGN_TO_FOREIGN', 'FOB', 'Santos', 'NET30', 'STANDARD', 'APPROVED');
      UPDATE "Contract" SET active_version_id = CASE kind WHEN 'SALES' THEN '00000000-0000-7000-8000-000000000009'::uuid ELSE '00000000-0000-7000-8000-00000000000a'::uuid END
        WHERE id IN ('00000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000008');
      INSERT INTO "SupplierShipment" (id, project_id, purchase_contract_id, reference) VALUES
        ('00000000-0000-7000-8000-00000000000b', '00000000-0000-7000-8000-000000000006', '00000000-0000-7000-8000-000000000008', 'T018-CONTAINER');
      INSERT INTO "SalesShipment" (id, project_id, sales_contract_id, reference) VALUES
        ('00000000-0000-7000-8000-00000000000c', '00000000-0000-7000-8000-000000000006', '00000000-0000-7000-8000-000000000007', 'T018-SHIPMENT');
      INSERT INTO "Approval" (id, action_code, subject_type, subject_id, subject_version, subject_hash, requester_id, decision) VALUES
        ('00000000-0000-7000-8000-00000000000d', 'SALES_SHIPMENT_CONFIRMATION', 'SalesShipmentDataset', '00000000-0000-7000-8000-00000000000e', 1, repeat('c',64), '00000000-0000-7000-8000-000000000001', 'APPROVED'),
        ('00000000-0000-7000-8000-00000000000f', 'SUPPLIER_SHIPMENT_CONFIRMATION', 'SupplierShipmentDataset', '00000000-0000-7000-8000-000000000010', 1, repeat('d',64), '00000000-0000-7000-8000-000000000001', 'APPROVED');
      INSERT INTO "SalesShipmentDataset" (id, shipment_id, revision_no, dataset_version, dataset_hash, sales_contract_id, coffee_specification_id, product_description, quantity, bag_count, bag_weight, net_weight, gross_weight, origin_country, origin_location, load_location, discharge_location, destination_country, destination_location, incoterm, named_place, container_numbers, seal_numbers, transport_mode, carrier, transport_reference, state, approval_id, created_by, revision_reason, invalidated_approval_ids) VALUES
        ('00000000-0000-7000-8000-00000000000e', '00000000-0000-7000-8000-00000000000c', 1, 1, repeat('a',64), '00000000-0000-7000-8000-000000000007', '00000000-0000-7000-8000-000000000004', 'Coffee', 40, 10, 60, 600, 610, 'BR', 'Santos', 'Santos', 'Dubai', 'AE', 'Dubai', 'FOB', 'Santos', ARRAY['C1'], ARRAY['S1'], 'SEA', 'Carrier', 'TR1', 'APPROVED', '00000000-0000-7000-8000-00000000000d', '00000000-0000-7000-8000-000000000001', 'initial', ARRAY[]::uuid[]);
      INSERT INTO "SupplierShipmentDataset" (id, shipment_id, revision_no, dataset_version, dataset_hash, purchase_contract_id, supplier_id, coffee_specification_id, supplier_lot_reference, quantity, bag_count, bag_weight, net_weight, gross_weight, origin_country, origin_location, load_location, destination_country, destination_location, incoterm, named_place, container_numbers, seal_numbers, transport_mode, carrier, transport_reference, state, approval_id, created_by, revision_reason, invalidated_approval_ids) VALUES
        ('00000000-0000-7000-8000-000000000010', '00000000-0000-7000-8000-00000000000b', 1, 1, repeat('b',64), '00000000-0000-7000-8000-000000000008', '00000000-0000-7000-8000-000000000003', '00000000-0000-7000-8000-000000000004', 'LOT-1', 40, 10, 60, 600, 610, 'BR', 'Santos', 'Santos', 'AE', 'Dubai', 'FOB', 'Santos', ARRAY['C1'], ARRAY['S1'], 'SEA', 'Carrier', 'TR1', 'APPROVED', '00000000-0000-7000-8000-00000000000f', '00000000-0000-7000-8000-000000000001', 'initial', ARRAY[]::uuid[]);
    `);

    const backfill = readFileSync(BACKFILL, "utf8");
    await client.query(backfill);
    const firstHashes = await client.query(`SELECT string_agg(line_hash::text, ',' ORDER BY line_hash) AS hashes FROM (
      SELECT line_hash FROM "ContractLineVersion" UNION ALL
      SELECT line_hash FROM "SalesShipmentDatasetLine" UNION ALL
      SELECT line_hash FROM "SupplierShipmentDatasetLine"
    ) lines`);
    await client.query(backfill);
    const result = await client.query(`
      SELECT
        (SELECT count(*) FROM "ContractLine") AS contract_lines,
        (SELECT count(*) FROM "ContractLineVersion") AS contract_line_versions,
        (SELECT count(*) FROM "SalesShipmentDatasetLine") AS sales_lines,
        (SELECT count(*) FROM "SupplierShipmentDatasetLine") AS supplier_lines,
        (SELECT dataset_hash FROM "SalesShipmentDataset" WHERE id='00000000-0000-7000-8000-00000000000e') AS sales_v1_hash,
        (SELECT dataset_hash FROM "SupplierShipmentDataset" WHERE id='00000000-0000-7000-8000-000000000010') AS supplier_v1_hash,
        (SELECT string_agg(subject_hash, ',' ORDER BY subject_hash) FROM "Approval") AS approval_hashes,
        (SELECT string_agg(line_hash::text, ',' ORDER BY line_hash) FROM (
          SELECT line_hash FROM "ContractLineVersion" UNION ALL
          SELECT line_hash FROM "SalesShipmentDatasetLine" UNION ALL
          SELECT line_hash FROM "SupplierShipmentDatasetLine"
        ) lines) AS hashes,
        (SELECT count(*) FROM orb_concept_realignment_reconciliation
          WHERE legacy_rows <> v2_rows OR legacy_quantity <> v2_quantity OR legacy_value <> v2_value) AS reconciliation_failures
    `);
    assert.deepEqual(result.rows[0], {
      contract_lines: "2", contract_line_versions: "2", sales_lines: "1", supplier_lines: "1",
      sales_v1_hash: "a".repeat(64), supplier_v1_hash: "b".repeat(64),
      approval_hashes: `${"c".repeat(64)},${"d".repeat(64)}`,
      hashes: firstHashes.rows[0].hashes, reconciliation_failures: "0",
    });
    assert.match(result.rows[0].hashes, /^[0-9a-f]{64}(,[0-9a-f]{64}){3}$/);
  } finally {
    await client.end();
  }
});

test("concept realignment migration is expand-only and keeps legacy application columns", { skip: redReason }, () => {
  const sql = readFileSync(EXPAND, "utf8");
  assert.match(sql, /CREATE TABLE "ContractLine"/);
  assert.match(sql, /CREATE TABLE "SalesShipmentDatasetLine"/);
  assert.match(sql, /CREATE TABLE "Permission"/);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(sql, /ALTER\s+COLUMN[^;]+SET\s+NOT\s+NULL/i);

  const initial = readFileSync(INITIAL, "utf8");
  for (const legacy of [
    '"ContractVersion"', '"coffee_specification_id"', '"SalesShipmentDataset"',
    '"SupplierShipmentDataset"', '"purchase_contract_id"', '"subject_type"',
  ]) assert.match(initial + sql, new RegExp(legacy));
});

test("legacy backfill is deterministic, idempotent, hash-versioned, and exposes reconciliation", { skip: redReason }, () => {
  const sql = readFileSync(BACKFILL, "utf8");
  for (const required of [
    'INSERT INTO "ContractLine"', 'INSERT INTO "ContractLineVersion"',
    'INSERT INTO "SalesShipmentDatasetLine"', 'INSERT INTO "SupplierShipmentDatasetLine"',
    "ON CONFLICT", "orb_line_hash_v2", "orb_concept_realignment_reconciliation",
    "dataset_hash", "hash_version", "line_hash",
  ]) assert.match(sql, new RegExp(required));
  assert.doesNotMatch(sql, /UPDATE\s+"(?:Sales|Supplier)ShipmentDataset"\s+SET\s+"?dataset_hash"?/i,
    "v1 dataset hashes must remain untouched");
  assert.doesNotMatch(sql, /UPDATE\s+"Approval"/i, "v1 approval bindings must remain untouched");
});

test("cutover runbook defines safe flag stages and application-only rollback", { skip: redReason }, () => {
  const runbook = readFileSync(CUTOVER, "utf8");
  for (const required of [
    "ORB_REALIGNMENT_DUAL_WRITE=0", "ORB_REALIGNMENT_DUAL_WRITE=1",
    "ORB_REALIGNMENT_READ_PATH=legacy", "ORB_REALIGNMENT_READ_PATH=compare",
    "ORB_REALIGNMENT_READ_PATH=v2", "no database down-migration",
  ]) assert.match(runbook, new RegExp(required));
});

test("migration history exactly matches the expected ordered migration set", { skip: redReason }, () => {
  const directories = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(directories, ["202611050001_r1_initial", "202611110001_concept_realignment_expand", "202611110002_concept_realignment_backfill", "202611110003_product_status_expand", "202611110034_settings_audit", "202611150001_customer_foundation", "202611160001_tenant_session_context", "202611160002_customer_business_profile", "202611160003_supplier_foundation", "202611160004_product_foundation", "202611170001_project_foundation", "202611170002_purchase_contract_daily_use", "202611170004_project_activation", "202611170005_supplier_shipment_daily_use", "202611170006_sales_shipment_daily_use", "202611190001_user_sign_in", "202611200001_shipment_execution", "202611210001_invoice_daily_use", "202611220001_money_daily_use", "202611230001_claims_closure", "202611240001_company_documents", "202611250001_optional_payment_slip"]);
});


test("T025 product status migration is additive and defaults existing products active", { skip: redReason }, () => {
  const sql = readFileSync(PRODUCT_STATUS, "utf8");
  assert.match(sql, /CREATE TYPE "ProductStatus" AS ENUM \('ACTIVE', 'INACTIVE'\)/);
  assert.match(sql, /ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE'/);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
});
