-- Additive commercial profile for tenant-owned customers. Existing records retain truthful null/default values.
ALTER TABLE "Customer"
  ADD COLUMN "legal_name_ar" TEXT,
  ADD COLUMN "country_code" CHAR(2),
  ADD COLUMN "tax_registration_number" TEXT,
  ADD COLUMN "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "billing_address" JSONB;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_legal_name_ar_length" CHECK ("legal_name_ar" IS NULL OR length(btrim("legal_name_ar")) BETWEEN 1 AND 200);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_country_code_format" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tax_registration_number_length" CHECK ("tax_registration_number" IS NULL OR length(btrim("tax_registration_number")) BETWEEN 1 AND 64);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_payment_terms_days_range" CHECK ("payment_terms_days" BETWEEN 0 AND 3650);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_billing_address_shape" CHECK ("billing_address" IS NULL OR (jsonb_typeof("billing_address") = 'object' AND jsonb_typeof("billing_address"->'line1') = 'string' AND jsonb_typeof("billing_address"->'city') = 'string'));


-- Mixed-version safety: legacy pods omit additive profile keys from audit JSON.
CREATE OR REPLACE FUNCTION "enrich_customer_profile_audit"() RETURNS trigger AS $$
DECLARE profile jsonb;
BEGIN
  SELECT jsonb_build_object('legalNameAr', "legal_name_ar", 'countryCode', "country_code", 'taxRegistrationNumber', "tax_registration_number", 'paymentTermsDays', "payment_terms_days", 'billingAddress', "billing_address")
  INTO profile FROM "Customer" WHERE "id" = NEW."customer_id" AND "tenant_id" = NEW."tenant_id";
  NEW."before" := CASE WHEN NEW."before" IS NULL THEN NULL ELSE profile || NEW."before" END;
  NEW."after" := profile || NEW."after";
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CustomerAuditEvent_enrich_profile" BEFORE INSERT ON "CustomerAuditEvent" FOR EACH ROW EXECUTE FUNCTION "enrich_customer_profile_audit"();
