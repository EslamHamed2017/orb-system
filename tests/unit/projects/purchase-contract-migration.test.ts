import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const schema=readFileSync("prisma/schema.prisma","utf8");
const migration=readFileSync("prisma/migrations/202611170002_purchase_contract_daily_use/migration.sql","utf8");

test("purchase migration safely replaces the original contract tenant shape",()=>{
  assert.match(migration,/DROP CONSTRAINT IF EXISTS "Contract_tenant_shape"/);
  assert.match(migration,/ADD CONSTRAINT "Contract_tenant_shape" CHECK/);
  assert.match(migration,/"tenant_id" IS NULL AND "counterparty_id" IS NOT NULL AND "counterparty_customer_id" IS NULL AND "counterparty_supplier_id" IS NULL/);
  assert.match(migration,/"kind"\s*=\s*'SALES'.*"counterparty_customer_id" IS NOT NULL.*"counterparty_supplier_id" IS NULL/s);
  assert.match(migration,/"kind"\s*=\s*'PURCHASE'.*"counterparty_supplier_id" IS NOT NULL.*"counterparty_customer_id" IS NULL/s);
  assert.doesNotMatch(migration,/Contract_tenant_counterparty_xor/);
});

test("purchase migration safely extends the project audit action constraint",()=>{
  assert.match(migration,/DROP CONSTRAINT IF EXISTS "ProjectAuditEvent_action_allowed"/);
  assert.match(migration,/ADD CONSTRAINT "ProjectAuditEvent_action_allowed" CHECK/);
  assert.match(migration,/PURCHASE_CONTRACT_CREATED/);
  for(const action of ["PROJECT_CREATED","PROJECT_UPDATED","PROJECT_CANCELLED"])assert.ok(migration.includes(action));
});


test("purchase migration wraps every schema change in one explicit transaction",()=>{
  const statements=migration.trim();
  assert.match(statements,/^BEGIN;/);
  assert.match(statements,/COMMIT;$/);
  assert.equal((statements.match(/\bBEGIN;/g)??[]).length,1);
  assert.equal((statements.match(/\bCOMMIT;/g)??[]).length,1);
});


test("Prisma supplier relation and index names match the purchase migration",()=>{
  assert.match(schema,/Supplier\s+Supplier\?\s+@relation\([^\r\n]+map: "Contract_counterparty_supplier_tenant_fkey"\)/);
  assert.match(schema,/@@index\(\[counterparty_supplier_id, tenant_id\], map: "Contract_counterparty_supplier_id_tenant_id_idx"\)/);
});


test("purchase idempotency snapshots are tenant-bound and retain the exact committed response",()=>{
  assert.match(migration,/ALTER TABLE "IdempotencyRecord" ADD COLUMN "tenant_id" UUID/);
  assert.match(migration,/ADD COLUMN "response_body" JSONB/);
  assert.match(migration,/FOREIGN KEY \("tenant_id"\) REFERENCES "Tenant"\("id"\)/);
  assert.match(migration,/createPurchaseContract[^;]+"tenant_id" IS NOT NULL[^;]+"response_body" IS NOT NULL/s);
  assert.match(schema,/tenant_id\s+String\?\s+@db\.Uuid/);
  assert.match(schema,/response_body\s+Json\?/);
});
