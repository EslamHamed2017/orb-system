-- Tenant-aware Project and primary SALES-contract expansion. Existing operational rows are never assigned to a tenant implicitly.
ALTER TABLE "Project" DROP CONSTRAINT "fk_5_Project";
ALTER TABLE "Project" DROP CONSTRAINT "fk_100_Project";
ALTER TABLE "Project" DROP CONSTRAINT "Project_reference_key";
ALTER TABLE "Project" ALTER COLUMN "customer_id" DROP NOT NULL;
ALTER TABLE "Project" ADD COLUMN "tenant_id" UUID, ADD COLUMN "customer_master_id" UUID, ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Contract" DROP CONSTRAINT "fk_6_Contract", DROP CONSTRAINT "fk_7_Contract", DROP CONSTRAINT "fk_101_Contract";
ALTER TABLE "Contract" ALTER COLUMN "counterparty_id" DROP NOT NULL;
ALTER TABLE "Contract" ADD COLUMN "tenant_id" UUID, ADD COLUMN "counterparty_customer_id" UUID;
ALTER TABLE "ContractVersion" DROP CONSTRAINT "fk_9_ContractVersion";
ALTER TABLE "ContractVersion" ADD COLUMN "tenant_id" UUID;

CREATE TABLE "LegacyProjectQuarantine" ("project_id" UUID PRIMARY KEY, "snapshot" JSONB NOT NULL, "operational_reference_count" INTEGER NOT NULL, "reason" TEXT NOT NULL DEFAULT 'TENANT_OWNERSHIP_UNKNOWN', "quarantined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LegacyProjectQuarantine_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "LegacyProjectQuarantine_count_nonnegative" CHECK ("operational_reference_count">=0));
INSERT INTO "LegacyProjectQuarantine" ("project_id","snapshot","operational_reference_count") SELECT p."id",to_jsonb(p),
  (SELECT count(*) FROM "AuditEvent" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "Claim" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "ClosureAssessment" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "CommercialDocument" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "Contract" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "DirectExpense" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "EvidenceLink" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "EvidenceObject" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "MoneyMovement" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "ProfitSnapshot" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "SalesInvoice" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "SalesShipment" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "SupplierInvoice" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "SupplierShipment" x WHERE x."project_id"=p."id")+
  (SELECT count(*) FROM "TransactionSerial" x WHERE x."project_id"=p."id")
FROM "Project" p;
CREATE TABLE "LegacyContractQuarantine" ("contract_id" UUID PRIMARY KEY, "snapshot" JSONB NOT NULL, "reason" TEXT NOT NULL DEFAULT 'TENANT_OWNERSHIP_UNKNOWN', "quarantined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LegacyContractQuarantine_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION);
INSERT INTO "LegacyContractQuarantine" ("contract_id","snapshot") SELECT "id",to_jsonb(c) FROM "Contract" c;
CREATE TRIGGER "LegacyProjectQuarantine_append_only" BEFORE UPDATE OR DELETE ON "LegacyProjectQuarantine" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
CREATE TRIGGER "LegacyContractQuarantine_append_only" BEFORE UPDATE OR DELETE ON "LegacyContractQuarantine" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();

CREATE UNIQUE INDEX "Project_legacy_reference_key" ON "Project"("reference") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX "Project_tenant_id_reference_key" ON "Project"("tenant_id","reference");
CREATE UNIQUE INDEX "Project_id_tenant_id_key" ON "Project"("id","tenant_id");
CREATE UNIQUE INDEX "Project_id_customer_master_id_tenant_id_key" ON "Project"("id","customer_master_id","tenant_id");
CREATE INDEX "Project_tenant_id_lifecycle_state_reference_idx" ON "Project"("tenant_id","lifecycle_state","reference");
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenant_shape" CHECK (("tenant_id" IS NULL AND "customer_id" IS NOT NULL AND "customer_master_id" IS NULL) OR ("tenant_id" IS NOT NULL AND "customer_id" IS NULL AND "customer_master_id" IS NOT NULL));
ALTER TABLE "Project" ADD CONSTRAINT "Project_primary_sales_contract_project_fkey" FOREIGN KEY ("primary_sales_contract_id","id") REFERENCES "Contract"("id","project_id") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Project" ADD CONSTRAINT "Project_customer_tenant_fkey" FOREIGN KEY ("customer_master_id","tenant_id") REFERENCES "Customer"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Project" ADD CONSTRAINT "fk_5_Project" FOREIGN KEY ("customer_id") REFERENCES "Party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "Contract_id_tenant_id_key" ON "Contract"("id","tenant_id");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenant_shape" CHECK (("tenant_id" IS NULL AND "counterparty_id" IS NOT NULL AND "counterparty_customer_id" IS NULL) OR ("tenant_id" IS NOT NULL AND "kind"='SALES' AND "counterparty_id" IS NULL AND "counterparty_customer_id" IS NOT NULL));
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "fk_6_Contract" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_project_tenant_fkey" FOREIGN KEY ("project_id","tenant_id") REFERENCES "Project"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_project_customer_tenant_fkey" FOREIGN KEY ("project_id","counterparty_customer_id","tenant_id") REFERENCES "Project"("id","customer_master_id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customer_tenant_fkey" FOREIGN KEY ("counterparty_customer_id","tenant_id") REFERENCES "Customer"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "fk_7_Contract" FOREIGN KEY ("counterparty_id") REFERENCES "Party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_active_version_contract_fkey" FOREIGN KEY ("active_version_id","id") REFERENCES "ContractVersion"("id","contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "fk_9_ContractVersion" FOREIGN KEY ("coffee_specification_id") REFERENCES "CoffeeSpecification"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contract_tenant_fkey" FOREIGN KEY ("contract_id","tenant_id") REFERENCES "Contract"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_product_tenant_fkey" FOREIGN KEY ("coffee_specification_id","tenant_id") REFERENCES "CoffeeSpecification"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- MATCH SIMPLE composite foreign keys skip validation when tenant_id is NULL. Deferred two-sided guards
-- preserve null-to-null legacy rows, support an atomic ownership cutover, and reject every partial transition.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Project" p JOIN "Contract" c ON c."id"=p."primary_sales_contract_id"
    WHERE c."project_id" IS DISTINCT FROM p."id" OR c."kind" IS DISTINCT FROM 'SALES'::"ContractKind"
  ) THEN RAISE EXCEPTION 'invalid legacy primary sales contract'; END IF;
END $$;

CREATE OR REPLACE FUNCTION orb_validate_project_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE contract_tenant UUID; contract_project UUID; contract_kind "ContractKind";
BEGIN
  IF EXISTS (SELECT 1 FROM "Contract" c WHERE c."project_id"=NEW."id" AND c."tenant_id" IS DISTINCT FROM NEW."tenant_id") THEN
    RAISE EXCEPTION 'project contract tenant mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW."primary_sales_contract_id" IS NOT NULL THEN
    SELECT "tenant_id","project_id","kind" INTO contract_tenant,contract_project,contract_kind FROM "Contract" WHERE "id"=NEW."primary_sales_contract_id";
    IF NOT FOUND OR contract_project IS DISTINCT FROM NEW."id" OR contract_tenant IS DISTINCT FROM NEW."tenant_id" OR contract_kind IS DISTINCT FROM 'SALES'::"ContractKind" THEN
      RAISE EXCEPTION 'project primary contract must be its same-tenant sales contract' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "Project_validate_primary_sales_contract" AFTER INSERT OR UPDATE ON "Project" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orb_validate_project_relationships();

CREATE OR REPLACE FUNCTION orb_validate_contract_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project_tenant UUID;
BEGIN
  SELECT "tenant_id" INTO project_tenant FROM "Project" WHERE "id"=NEW."project_id";
  IF NOT FOUND OR NEW."tenant_id" IS DISTINCT FROM project_tenant THEN
    RAISE EXCEPTION 'contract project tenant mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Project" p WHERE p."primary_sales_contract_id"=NEW."id"
    AND (NEW."project_id" IS DISTINCT FROM p."id" OR NEW."tenant_id" IS DISTINCT FROM p."tenant_id" OR NEW."kind" IS DISTINCT FROM 'SALES'::"ContractKind")
  ) THEN RAISE EXCEPTION 'project primary contract must remain its same-tenant sales contract' USING ERRCODE='23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM "ContractVersion" v LEFT JOIN "CoffeeSpecification" product ON product."id"=v."coffee_specification_id"
    WHERE v."contract_id"=NEW."id" AND (
      v."tenant_id" IS DISTINCT FROM NEW."tenant_id" OR
      (NEW."tenant_id" IS NOT NULL AND product."tenant_id" IS DISTINCT FROM NEW."tenant_id")
    )
  ) THEN RAISE EXCEPTION 'contract version tenant mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "Contract_validate_project_tenant" AFTER INSERT OR UPDATE ON "Contract" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orb_validate_contract_relationships();

-- Legacy versions remain readable through the simple product FK. Tenant-owned versions carry the exact parent and product tenant.
CREATE OR REPLACE FUNCTION orb_validate_contract_version_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_tenant UUID; product_tenant UUID;
BEGIN
  SELECT "tenant_id" INTO parent_tenant FROM "Contract" WHERE "id"=NEW."contract_id";
  IF NOT FOUND OR NEW."tenant_id" IS DISTINCT FROM parent_tenant THEN
    RAISE EXCEPTION 'contract version tenant mismatch' USING ERRCODE='23514';
  END IF;
  IF parent_tenant IS NULL THEN RETURN NEW; END IF;
  SELECT "tenant_id" INTO product_tenant FROM "CoffeeSpecification" WHERE "id"=NEW."coffee_specification_id";
  IF NOT FOUND OR product_tenant IS DISTINCT FROM parent_tenant THEN
    RAISE EXCEPTION 'contract version product tenant mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "ContractVersion_validate_tenant" AFTER INSERT OR UPDATE ON "ContractVersion" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orb_validate_contract_version_tenant();
-- Permit only a controlled one-time ownership assignment on quarantined legacy versions; all commercial facts remain immutable.
DROP TRIGGER "ContractVersion_immutable_content" ON "ContractVersion";
CREATE TRIGGER "ContractVersion_immutable_content" BEFORE UPDATE ON "ContractVersion" FOR EACH ROW EXECUTE FUNCTION orb_guard_immutable_content('state', 'approval_id', 'tenant_id');

CREATE TABLE "ProjectAuditEvent" ("id" UUID PRIMARY KEY DEFAULT orb_uuidv7(), "tenant_id" UUID NOT NULL, "project_id" UUID NOT NULL, "actor_id" UUID NOT NULL, "action" TEXT NOT NULL, "aggregate_version" INTEGER NOT NULL, "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "after" JSONB NOT NULL, CONSTRAINT "ProjectAuditEvent_version_positive" CHECK ("aggregate_version">0), CONSTRAINT "ProjectAuditEvent_action_allowed" CHECK ("action" IN ('PROJECT_CREATED','PROJECT_UPDATED','PROJECT_CANCELLED')));
CREATE UNIQUE INDEX "ProjectAuditEvent_project_id_aggregate_version_key" ON "ProjectAuditEvent"("project_id","aggregate_version");
CREATE INDEX "ProjectAuditEvent_tenant_id_occurred_at_idx" ON "ProjectAuditEvent"("tenant_id","occurred_at");
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_project_tenant_fkey" FOREIGN KEY ("project_id","tenant_id") REFERENCES "Project"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "TenantMembership"("tenant_id","user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "ProjectAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "ProjectAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orb_app') THEN REVOKE UPDATE, DELETE ON "ProjectAuditEvent", "LegacyProjectQuarantine", "LegacyContractQuarantine" FROM orb_app; END IF; END $$;
