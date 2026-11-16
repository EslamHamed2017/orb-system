-- Trusted tenant context: session credentials are stored only as SHA-256 hashes.
ALTER TABLE "Session" ADD COLUMN "token_hash" CHAR(64);
ALTER TABLE "Session" ADD CONSTRAINT "Session_token_hash_format" CHECK ("token_hash" IS NULL OR "token_hash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "Session" ADD CONSTRAINT "Session_token_hash_key" UNIQUE ("token_hash");

CREATE TABLE "TenantMembership" (
  "id" UUID NOT NULL DEFAULT orb_uuidv7(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantMembership_status_allowed" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT "TenantMembership_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id"),
  CONSTRAINT "TenantMembership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "TenantMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "TenantMembership_user_id_status_idx" ON "TenantMembership"("user_id", "status");
CREATE UNIQUE INDEX "TenantMembership_one_active_tenant_per_user" ON "TenantMembership"("user_id") WHERE "status" = 'ACTIVE';
