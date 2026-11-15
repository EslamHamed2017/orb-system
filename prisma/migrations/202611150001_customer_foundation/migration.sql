-- Additive customer persistence foundation. Existing Party rows remain untouched because no truthful tenant mapping exists.
CREATE TABLE "Tenant" (
  "id" UUID NOT NULL DEFAULT orb_uuidv7(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tenant_slug_format" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  CONSTRAINT "Tenant_name_required" CHECK (length(btrim("name")) BETWEEN 1 AND 160)
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TABLE "Customer" (
  "id" UUID NOT NULL DEFAULT orb_uuidv7(),
  "tenant_id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "legal_name" TEXT NOT NULL,
  "contact_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Customer_version_positive" CHECK ("version" > 0),
  CONSTRAINT "Customer_reference_format" CHECK ("reference" ~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$'),
  CONSTRAINT "Customer_legal_name_required" CHECK (length(btrim("legal_name")) BETWEEN 1 AND 200),
  CONSTRAINT "Customer_contact_name_length" CHECK ("contact_name" IS NULL OR length("contact_name") BETWEEN 1 AND 160),
  CONSTRAINT "Customer_email_length" CHECK ("email" IS NULL OR length("email") BETWEEN 3 AND 254),
  CONSTRAINT "Customer_phone_length" CHECK ("phone" IS NULL OR length("phone") BETWEEN 7 AND 32),
  CONSTRAINT "Customer_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL)
);
CREATE UNIQUE INDEX "Customer_tenant_id_reference_key" ON "Customer"("tenant_id", "reference");
CREATE UNIQUE INDEX "Customer_id_tenant_id_key" ON "Customer"("id", "tenant_id");
CREATE INDEX "Customer_tenant_id_status_legal_name_idx" ON "Customer"("tenant_id", "status", "legal_name");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "CustomerAuditEvent" (
  "id" UUID NOT NULL DEFAULT orb_uuidv7(),
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "aggregate_version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "before" JSONB,
  "after" JSONB NOT NULL,
  CONSTRAINT "CustomerAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAuditEvent_version_positive" CHECK ("aggregate_version" > 0),
  CONSTRAINT "CustomerAuditEvent_action_allowed" CHECK ("action" IN ('CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_DEACTIVATED')),
  CONSTRAINT "CustomerAuditEvent_create_before_null" CHECK (("aggregate_version" = 1 AND "before" IS NULL) OR ("aggregate_version" > 1 AND "before" IS NOT NULL))
);
CREATE UNIQUE INDEX "CustomerAuditEvent_customer_id_aggregate_version_key" ON "CustomerAuditEvent"("customer_id", "aggregate_version");
CREATE INDEX "CustomerAuditEvent_tenant_id_occurred_at_idx" ON "CustomerAuditEvent"("tenant_id", "occurred_at");
CREATE INDEX "CustomerAuditEvent_actor_id_idx" ON "CustomerAuditEvent"("actor_id");
ALTER TABLE "CustomerAuditEvent" ADD CONSTRAINT "CustomerAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CustomerAuditEvent" ADD CONSTRAINT "CustomerAuditEvent_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id", "tenant_id") REFERENCES "Customer"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CustomerAuditEvent" ADD CONSTRAINT "CustomerAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "CustomerAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "CustomerAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orb_app') THEN REVOKE UPDATE, DELETE ON "CustomerAuditEvent" FROM orb_app; END IF; END $$;
