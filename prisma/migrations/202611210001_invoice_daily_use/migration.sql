-- Invoices on the tenant model (like shipments in 202611170005/6): tenant-owned supplier/customer
-- masters instead of the global Party, one invoice line per shipment (dataset lines optional),
-- and an append-only invoice audit trail. Additive: legacy rows keep their Party columns.

ALTER TABLE "SupplierInvoice" ADD COLUMN "tenant_id" UUID, ADD COLUMN "supplier_master_id" UUID;
ALTER TABLE "SupplierInvoice" ALTER COLUMN "supplier_id" DROP NOT NULL;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "supplier_id" IS NOT NULL AND "supplier_master_id" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "supplier_id" IS NULL AND "supplier_master_id" IS NOT NULL));
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplier_master_fkey" FOREIGN KEY ("supplier_master_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_amount_positive" CHECK ("amount" > 0);
CREATE UNIQUE INDEX "SupplierInvoice_supplier_master_reference_key" ON "SupplierInvoice"("tenant_id", "supplier_master_id", "reference") WHERE "tenant_id" IS NOT NULL;
CREATE UNIQUE INDEX "SupplierInvoice_one_active_per_shipment" ON "SupplierInvoice"("supplier_shipment_id") WHERE "tenant_id" IS NOT NULL AND "state" NOT IN ('CANCELLED', 'REJECTED');
CREATE INDEX "SupplierInvoice_tenant_project_idx" ON "SupplierInvoice"("tenant_id", "project_id", "state");

ALTER TABLE "SupplierInvoiceLine" ALTER COLUMN "supplier_id" DROP NOT NULL;
ALTER TABLE "SupplierInvoiceLine" ALTER COLUMN "supplier_shipment_dataset_line_id" DROP NOT NULL;

ALTER TABLE "SalesInvoice" ADD COLUMN "tenant_id" UUID, ADD COLUMN "customer_master_id" UUID, ADD COLUMN "issued_at" TIMESTAMPTZ(6), ADD COLUMN "issued_by" UUID;
ALTER TABLE "SalesInvoice" ALTER COLUMN "customer_id" DROP NOT NULL;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "customer_id" IS NOT NULL AND "customer_master_id" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "customer_id" IS NULL AND "customer_master_id" IS NOT NULL));
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customer_master_fkey" FOREIGN KEY ("customer_master_id", "tenant_id") REFERENCES "Customer"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "SalesInvoice_tenant_reference_key" ON "SalesInvoice"("tenant_id", "reference") WHERE "tenant_id" IS NOT NULL;
CREATE INDEX "SalesInvoice_tenant_project_idx" ON "SalesInvoice"("tenant_id", "project_id", "state");

ALTER TABLE "SalesInvoiceLine" ALTER COLUMN "sales_shipment_dataset_line_id" DROP NOT NULL;

CREATE TABLE "InvoiceAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "project_id" UUID NOT NULL,
 "invoice_type" TEXT NOT NULL,
 "invoice_id" UUID NOT NULL,
 "actor_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT "InvoiceAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "InvoiceAuditEvent_type_allowed" CHECK ("invoice_type" IN ('SUPPLIER','SALES')),
 CONSTRAINT "InvoiceAuditEvent_action_allowed" CHECK ("action" IN ('CREATED','SUBMITTED','APPROVED','REJECTED','ISSUED','CANCELLED'))
);
CREATE INDEX "InvoiceAuditEvent_invoice_idx" ON "InvoiceAuditEvent"("invoice_type", "invoice_id", "occurred_at");
ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "InvoiceAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "InvoiceAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
