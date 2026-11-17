BEGIN;

-- Additive nullable supplier ownership preserves the exact legacy null-tenant shape and enables tenant purchase contracts.
ALTER TABLE "Contract" ADD COLUMN "counterparty_supplier_id" UUID;
CREATE INDEX "Contract_counterparty_supplier_id_tenant_id_idx" ON "Contract"("counterparty_supplier_id", "tenant_id");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_counterparty_supplier_tenant_fkey"
  FOREIGN KEY ("counterparty_supplier_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Replace, rather than layer on, the foundation constraint because it admitted tenant SALES/customer contracts only.
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_tenant_shape";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "counterparty_id" IS NOT NULL AND "counterparty_customer_id" IS NULL AND "counterparty_supplier_id" IS NULL) OR
  ("tenant_id" IS NOT NULL AND "kind" = 'SALES' AND "counterparty_id" IS NULL AND "counterparty_customer_id" IS NOT NULL AND "counterparty_supplier_id" IS NULL) OR
  ("tenant_id" IS NOT NULL AND "kind" = 'PURCHASE' AND "counterparty_id" IS NULL AND "counterparty_supplier_id" IS NOT NULL AND "counterparty_customer_id" IS NULL)
);

-- Exact response snapshots make retries stable even after later project mutations commit.
-- Tenant binding keeps a shared actor's idempotency records from crossing organization boundaries.
ALTER TABLE "IdempotencyRecord" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "response_body" JSONB;
CREATE INDEX "IdempotencyRecord_tenant_id_actor_id_idx" ON "IdempotencyRecord"("tenant_id", "actor_id");
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_purchase_response_snapshot" CHECK (
  "operation_id" <> 'createPurchaseContract' OR ("tenant_id" IS NOT NULL AND "response_body" IS NOT NULL)
);

-- Retain every foundation action while admitting the append-only event emitted by purchase-contract creation.
ALTER TABLE "ProjectAuditEvent" DROP CONSTRAINT IF EXISTS "ProjectAuditEvent_action_allowed";
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_action_allowed" CHECK (
  "action" IN ('PROJECT_CREATED','PROJECT_UPDATED','PROJECT_CANCELLED','PURCHASE_CONTRACT_CREATED')
);

COMMIT;
