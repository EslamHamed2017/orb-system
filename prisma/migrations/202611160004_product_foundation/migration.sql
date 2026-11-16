-- Expand the legacy operational product table without inventing tenant ownership.
ALTER TABLE "CoffeeSpecification" DROP CONSTRAINT "CoffeeSpecification_reference_key";
ALTER TABLE "CoffeeSpecification"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve an explicit, immutable inventory of rows that predate tenant ownership.
-- They remain in place because Projects/contracts/shipment datasets still reference their IDs.
CREATE TABLE "LegacyProductQuarantine" (
  "product_id" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "operational_reference_count" INTEGER NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'TENANT_OWNERSHIP_UNKNOWN',
  "quarantined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyProductQuarantine_pkey" PRIMARY KEY ("product_id"),
  CONSTRAINT "LegacyProductQuarantine_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "CoffeeSpecification"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "LegacyProductQuarantine_reference_count_nonnegative" CHECK ("operational_reference_count" >= 0)
);
INSERT INTO "LegacyProductQuarantine" ("product_id", "snapshot", "operational_reference_count")
SELECT p."id", to_jsonb(p),
  (SELECT count(*) FROM "ContractVersion" x WHERE x."coffee_specification_id"=p."id") +
  (SELECT count(*) FROM "ContractLineVersion" x WHERE x."coffee_specification_id"=p."id") +
  (SELECT count(*) FROM "SalesShipmentDataset" x WHERE x."coffee_specification_id"=p."id") +
  (SELECT count(*) FROM "SupplierShipmentDataset" x WHERE x."coffee_specification_id"=p."id")
FROM "CoffeeSpecification" p;
CREATE TRIGGER "LegacyProductQuarantine_append_only" BEFORE UPDATE OR DELETE ON "LegacyProductQuarantine" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();

ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_ownership_complete" CHECK (("tenant_id" IS NULL AND "name_en" IS NULL AND "name_ar" IS NULL) OR ("tenant_id" IS NOT NULL AND "name_en" IS NOT NULL AND "name_ar" IS NOT NULL));
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_version_positive" CHECK ("version" > 0);
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_reference_format" CHECK ("tenant_id" IS NULL OR "reference" ~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$');
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_names_required" CHECK ("tenant_id" IS NULL OR (length(btrim("name_en")) BETWEEN 1 AND 200 AND length(btrim("name_ar")) BETWEEN 1 AND 200));
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_origin_format" CHECK ("tenant_id" IS NULL OR ("origin" ~ '^[A-Z]{2}$'));
ALTER TABLE "CoffeeSpecification" ADD CONSTRAINT "CoffeeSpecification_weight_positive" CHECK ("standard_bag_weight" > 0);
CREATE UNIQUE INDEX "CoffeeSpecification_legacy_reference_key" ON "CoffeeSpecification"("reference") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX "CoffeeSpecification_tenant_id_reference_key" ON "CoffeeSpecification"("tenant_id","reference");
CREATE UNIQUE INDEX "CoffeeSpecification_id_tenant_id_key" ON "CoffeeSpecification"("id","tenant_id");
CREATE INDEX "CoffeeSpecification_tenant_id_status_name_en_idx" ON "CoffeeSpecification"("tenant_id","status","name_en");
CREATE TABLE "ProductAuditEvent" ("id" UUID NOT NULL DEFAULT orb_uuidv7(), "tenant_id" UUID NOT NULL, "product_id" UUID NOT NULL, "actor_id" UUID NOT NULL, "action" TEXT NOT NULL, "aggregate_version" INTEGER NOT NULL, "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "before" JSONB, "after" JSONB NOT NULL, CONSTRAINT "ProductAuditEvent_pkey" PRIMARY KEY ("id"), CONSTRAINT "ProductAuditEvent_version_positive" CHECK ("aggregate_version">0), CONSTRAINT "ProductAuditEvent_action_allowed" CHECK ("action" IN ('PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_DEACTIVATED','PRODUCT_REACTIVATED')), CONSTRAINT "ProductAuditEvent_create_before_null" CHECK (("aggregate_version"=1 AND "before" IS NULL) OR ("aggregate_version">1 AND "before" IS NOT NULL)));
CREATE UNIQUE INDEX "ProductAuditEvent_product_id_aggregate_version_key" ON "ProductAuditEvent"("product_id","aggregate_version");
CREATE INDEX "ProductAuditEvent_tenant_id_occurred_at_idx" ON "ProductAuditEvent"("tenant_id","occurred_at");
CREATE INDEX "ProductAuditEvent_actor_id_idx" ON "ProductAuditEvent"("actor_id");
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_product_tenant_fkey" FOREIGN KEY ("product_id","tenant_id") REFERENCES "CoffeeSpecification"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "TenantMembership"("tenant_id","user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "ProductAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "ProductAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orb_app') THEN REVOKE UPDATE, DELETE ON "ProductAuditEvent", "LegacyProductQuarantine" FROM orb_app; END IF; END $$;
