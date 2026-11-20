-- QuickBooks-style attachments are optional on payments: a receipt or payment can be saved without a bank slip.
-- Bills and expenses keep their required document (evidence_id stays NOT NULL there).
ALTER TABLE "MoneyMovement" DROP CONSTRAINT "MoneyMovement_tenant_shape";
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "party_id" IS NOT NULL AND "contract_id" IS NOT NULL AND "customer_master_id" IS NULL AND "supplier_master_id" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "party_id" IS NULL
      AND num_nonnulls("customer_master_id", "supplier_master_id") = 1
      AND "fx_rate" IS NOT NULL AND "recorded_by" IS NOT NULL AND "recorded_at" IS NOT NULL
      AND "amount" > 0 AND "fx_rate" > 0 AND "direction" IN ('IN', 'OUT')
      AND (("kind" IN ('CUSTOMER_RECEIPT', 'CUSTOMER_REFUND', 'CUSTOMER_ADVANCE') AND "customer_master_id" IS NOT NULL)
        OR ("kind" IN ('SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'SUPPLIER_ADVANCE') AND "supplier_master_id" IS NOT NULL))));
