-- Money on the tenant model: customer receipts and supplier payments linked to tenant-owned
-- Customer/Supplier masters (instead of the global Party), with a required bank slip and a manual
-- FX rate to AED; allocation of money to invoices with reasoned reversals; direct project expenses
-- with the bill attached and owner approval; and an append-only money audit trail.
-- Additive: legacy Party-based rows keep their columns and stay valid.

-- New states/approval kind. They are only used by application code (never inside this migration).
ALTER TYPE "MoneyMovementState" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "MoneyMovementState" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "ApprovalActionCode" ADD VALUE IF NOT EXISTS 'MONEY_MOVEMENT';

-- ---------------- money movements ----------------
ALTER TABLE "MoneyMovement"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "customer_master_id" UUID,
  ADD COLUMN "supplier_master_id" UUID,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "recorded_by" UUID,
  ADD COLUMN "recorded_at" TIMESTAMPTZ(6),
  ADD COLUMN "reversal_reason" TEXT,
  ADD COLUMN "reversed_by" UUID,
  ADD COLUMN "reversed_at" TIMESTAMPTZ(6);
ALTER TABLE "MoneyMovement" ALTER COLUMN "party_id" DROP NOT NULL;
ALTER TABLE "MoneyMovement" ALTER COLUMN "contract_id" DROP NOT NULL;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "party_id" IS NOT NULL AND "contract_id" IS NOT NULL AND "customer_master_id" IS NULL AND "supplier_master_id" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "party_id" IS NULL
      AND num_nonnulls("customer_master_id", "supplier_master_id") = 1
      AND "evidence_id" IS NOT NULL AND "fx_rate" IS NOT NULL AND "recorded_by" IS NOT NULL AND "recorded_at" IS NOT NULL
      AND "amount" > 0 AND "fx_rate" > 0 AND "direction" IN ('IN', 'OUT')
      AND (("kind" IN ('CUSTOMER_RECEIPT', 'CUSTOMER_REFUND', 'CUSTOMER_ADVANCE') AND "customer_master_id" IS NOT NULL)
        OR ("kind" IN ('SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'SUPPLIER_ADVANCE') AND "supplier_master_id" IS NOT NULL))));
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_reversal_shape" CHECK (
  "reversed_at" IS NULL OR ("reversed_by" IS NOT NULL AND length(btrim("reversal_reason")) >= 3));
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_customer_master_fkey" FOREIGN KEY ("customer_master_id", "tenant_id") REFERENCES "Customer"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_supplier_master_fkey" FOREIGN KEY ("supplier_master_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "MoneyMovement_tenant_project_idx" ON "MoneyMovement"("tenant_id", "project_id", "occurred_on");

-- ---------------- allocations (money -> invoice) ----------------
ALTER TABLE "SettlementAllocation"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "reversed_by" UUID,
  ADD COLUMN "reversed_at" TIMESTAMPTZ(6);
-- A reversed allocation keeps who/when/why. Legacy rows used a reversing row (reversal_of_id).
ALTER TABLE "SettlementAllocation" DROP CONSTRAINT "SettlementAllocation_check";
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_check" CHECK (
  "state" <> 'REVERSED' OR ("reversal_reason" IS NOT NULL AND ("reversal_of_id" IS NOT NULL OR ("reversed_at" IS NOT NULL AND "reversed_by" IS NOT NULL))));
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenant_amount_positive" CHECK ("tenant_id" IS NULL OR "amount" > 0);
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "SettlementAllocation_target_active_idx" ON "SettlementAllocation"("target_type", "target_id") WHERE "state" = 'ACTIVE';
CREATE INDEX "SettlementAllocation_movement_idx" ON "SettlementAllocation"("movement_id", "state");

-- ---------------- direct expenses ----------------
ALTER TABLE "DirectExpense"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "supplier_master_id" UUID,
  ADD COLUMN "payee_name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "supplier_shipment_id" UUID,
  ADD COLUMN "aed_amount" DECIMAL(20, 6),
  ADD COLUMN "fx_rate" DECIMAL(20, 10),
  ADD COLUMN "recorded_by" UUID,
  ADD COLUMN "recorded_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_by" UUID,
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6);
ALTER TABLE "DirectExpense" ALTER COLUMN "vendor_id" DROP NOT NULL;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "vendor_id" IS NOT NULL AND "supplier_master_id" IS NULL AND "payee_name" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "vendor_id" IS NULL
      AND ("supplier_master_id" IS NOT NULL OR length(btrim(coalesce("payee_name", ''))) >= 2)
      AND "amount" > 0 AND "fx_rate" IS NOT NULL AND "fx_rate" > 0 AND "aed_amount" IS NOT NULL
      AND "recorded_by" IS NOT NULL AND "recorded_at" IS NOT NULL
      AND num_nonnulls("sales_shipment_id", "supplier_shipment_id") <= 1));
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_cancel_shape" CHECK (
  "cancelled_at" IS NULL OR ("cancelled_by" IS NOT NULL AND length(btrim(coalesce("cancellation_reason", ''))) >= 3));
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_supplier_master_fkey" FOREIGN KEY ("supplier_master_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_supplier_shipment_fkey" FOREIGN KEY ("supplier_shipment_id", "project_id") REFERENCES "SupplierShipment"("id", "project_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "DirectExpense" ADD CONSTRAINT "DirectExpense_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "DirectExpense_tenant_project_idx" ON "DirectExpense"("tenant_id", "project_id", "state");

-- Everyday trade cost categories (bilingual). Existing categories are kept.
INSERT INTO "ExpenseCategory" ("code", "name_en", "name_ar") VALUES
  ('FREIGHT', 'Freight', 'الشحن'),
  ('TRUCKING', 'Trucking / inland transport', 'النقل الداخلي'),
  ('CUSTOMS', 'Customs and duties', 'الجمارك والرسوم'),
  ('CLEARING', 'Clearing agent', 'التخليص'),
  ('PORT_CHARGES', 'Port and terminal charges', 'رسوم الميناء'),
  ('STORAGE', 'Storage / warehouse', 'التخزين'),
  ('INSPECTION', 'Inspection and quality', 'الفحص والجودة'),
  ('INSURANCE', 'Insurance', 'التأمين'),
  ('DOCUMENTATION', 'Documents and certificates', 'المستندات والشهادات'),
  ('BANK_CHARGES', 'Bank charges', 'رسوم بنكية'),
  ('OTHER', 'Other', 'أخرى')
ON CONFLICT ("code") DO NOTHING;

-- ---------------- audit ----------------
CREATE TABLE "MoneyAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "project_id" UUID NOT NULL,
 "subject_type" TEXT NOT NULL,
 "subject_id" UUID NOT NULL,
 "actor_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT "MoneyAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MoneyAuditEvent_subject_allowed" CHECK ("subject_type" IN ('MOVEMENT', 'ALLOCATION', 'EXPENSE')),
 CONSTRAINT "MoneyAuditEvent_action_allowed" CHECK ("action" IN ('RECORDED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ALLOCATED', 'REVERSED', 'CANCELLED'))
);
CREATE INDEX "MoneyAuditEvent_subject_idx" ON "MoneyAuditEvent"("subject_type", "subject_id", "occurred_at");
CREATE INDEX "MoneyAuditEvent_project_idx" ON "MoneyAuditEvent"("tenant_id", "project_id", "occurred_at");
ALTER TABLE "MoneyAuditEvent" ADD CONSTRAINT "MoneyAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "MoneyAuditEvent" ADD CONSTRAINT "MoneyAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "MoneyAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "MoneyAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
