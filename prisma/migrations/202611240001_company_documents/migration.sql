-- Company profile per tenant (what prints on every document) and VAT on customer invoices.

CREATE TABLE "CompanyProfile" (
 "tenant_id" UUID NOT NULL,
 "profile" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "logo" BYTEA,
 "logo_media_type" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1,
 "updated_at" TIMESTAMPTZ(6),
 "updated_by" UUID,
 CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("tenant_id"),
 CONSTRAINT "CompanyProfile_logo_shape" CHECK (("logo" IS NULL AND "logo_media_type" IS NULL) OR ("logo" IS NOT NULL AND octet_length("logo") <= 524288 AND "logo_media_type" IN ('image/png', 'image/jpeg', 'image/webp'))),
 CONSTRAINT "CompanyProfile_version_positive" CHECK ("version" >= 1)
);
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "CompanyProfileHistory" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "version" INTEGER NOT NULL,
 "profile" JSONB NOT NULL,
 "logo_changed" BOOLEAN NOT NULL DEFAULT FALSE,
 "reason" TEXT NOT NULL,
 "changed_by" UUID NOT NULL,
 "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CompanyProfileHistory_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CompanyProfileHistory_tenant_version_key" UNIQUE ("tenant_id", "version")
);
ALTER TABLE "CompanyProfileHistory" ADD CONSTRAINT "CompanyProfileHistory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "CompanyProfileHistory" ADD CONSTRAINT "CompanyProfileHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "CompanyProfileHistory_append_only" BEFORE UPDATE OR DELETE ON "CompanyProfileHistory" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();

-- VAT on customer invoices: the treatment and rate chosen when the invoice is issued; the VAT amount is added to
-- what the customer owes. Revenue stays net of VAT. Existing invoices are zero-rated with no VAT.
ALTER TABLE "SalesInvoice"
  ADD COLUMN "vat_treatment" TEXT NOT NULL DEFAULT 'ZERO_RATED',
  ADD COLUMN "vat_rate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "vat_amount" DECIMAL(20, 6) NOT NULL DEFAULT 0;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_vat_shape" CHECK (
  "vat_treatment" IN ('STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE')
  AND "vat_rate" >= 0 AND "vat_rate" <= 100 AND "vat_amount" >= 0
  AND ("vat_treatment" = 'STANDARD' OR ("vat_rate" = 0 AND "vat_amount" = 0)));
