-- Additive tenant-owned supplier master; global Party cannot be truthfully backfilled.
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TABLE "Supplier" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(), "tenant_id" UUID NOT NULL, "reference" TEXT NOT NULL,
 "registered_name" TEXT NOT NULL, "display_name_ar" TEXT, "country_code" CHAR(2) NOT NULL,
 "contact_name" TEXT, "email" TEXT, "phone" TEXT, "payment_currency" CHAR(3) NOT NULL,
 "payment_terms_days" INTEGER NOT NULL DEFAULT 0, "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
 "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Supplier_version_positive" CHECK ("version" > 0), CONSTRAINT "Supplier_reference_format" CHECK ("reference" ~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$'),
 CONSTRAINT "Supplier_names_required" CHECK (length(btrim("registered_name")) BETWEEN 1 AND 200 AND ("display_name_ar" IS NULL OR length(btrim("display_name_ar")) BETWEEN 1 AND 200)),
 CONSTRAINT "Supplier_country_code_format" CHECK ("country_code" ~ '^[A-Z]{2}$'), CONSTRAINT "Supplier_payment_currency_format" CHECK ("payment_currency" ~ '^[A-Z]{3}$'),
 CONSTRAINT "Supplier_payment_terms_range" CHECK ("payment_terms_days" BETWEEN 0 AND 365), CONSTRAINT "Supplier_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL)
);
CREATE UNIQUE INDEX "Supplier_tenant_id_reference_key" ON "Supplier"("tenant_id", "reference");
CREATE UNIQUE INDEX "Supplier_id_tenant_id_key" ON "Supplier"("id", "tenant_id");
CREATE INDEX "Supplier_tenant_id_status_registered_name_idx" ON "Supplier"("tenant_id", "status", "registered_name");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TABLE "SupplierAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(), "tenant_id" UUID NOT NULL, "supplier_id" UUID NOT NULL, "actor_id" UUID NOT NULL,
 "action" TEXT NOT NULL, "aggregate_version" INTEGER NOT NULL, "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "before" JSONB, "after" JSONB NOT NULL, CONSTRAINT "SupplierAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SupplierAuditEvent_version_positive" CHECK ("aggregate_version" > 0),
 CONSTRAINT "SupplierAuditEvent_action_allowed" CHECK ("action" IN ('SUPPLIER_CREATED','SUPPLIER_UPDATED','SUPPLIER_DEACTIVATED','SUPPLIER_REACTIVATED')),
 CONSTRAINT "SupplierAuditEvent_create_before_null" CHECK (("aggregate_version" = 1 AND "before" IS NULL) OR ("aggregate_version" > 1 AND "before" IS NOT NULL))
);
CREATE UNIQUE INDEX "SupplierAuditEvent_supplier_id_aggregate_version_key" ON "SupplierAuditEvent"("supplier_id", "aggregate_version");
CREATE INDEX "SupplierAuditEvent_tenant_id_occurred_at_idx" ON "SupplierAuditEvent"("tenant_id", "occurred_at");
CREATE INDEX "SupplierAuditEvent_actor_id_idx" ON "SupplierAuditEvent"("actor_id");
ALTER TABLE "SupplierAuditEvent" ADD CONSTRAINT "SupplierAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierAuditEvent" ADD CONSTRAINT "SupplierAuditEvent_supplier_id_tenant_id_fkey" FOREIGN KEY ("supplier_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierAuditEvent" ADD CONSTRAINT "SupplierAuditEvent_tenant_actor_fkey" FOREIGN KEY ("tenant_id", "actor_id") REFERENCES "TenantMembership"("tenant_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierAuditEvent" ADD CONSTRAINT "SupplierAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "SupplierAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "SupplierAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orb_app') THEN REVOKE UPDATE, DELETE ON "SupplierAuditEvent" FROM orb_app; END IF; END $$;
