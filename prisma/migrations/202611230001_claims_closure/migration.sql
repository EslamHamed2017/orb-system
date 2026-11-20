-- Claims and project closure on the tenant model.
-- Claims: raised on one shipment; a customer claim (on a sales shipment) is against us, a supplier claim (on a supplier
-- shipment) is ours against the supplier. Outcomes carry the settled amount and are approved by an owner.
-- Closure: an assessment snapshot with its blockers; blockers may be accepted with a written reason; final close and
-- reopen are owner-approved. A finally closed project is read-only, enforced in the database.
-- Additive: legacy Party-based claim rows stay valid.

-- ---------------- claims ----------------
ALTER TABLE "Claim"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "side" TEXT,
  ADD COLUMN "customer_master_id" UUID,
  ADD COLUMN "supplier_master_id" UUID,
  ADD COLUMN "opened_by" UUID,
  ADD COLUMN "opened_at" TIMESTAMPTZ(6),
  ADD COLUMN "settled_amount" DECIMAL(20, 6),
  ADD COLUMN "closed_at" TIMESTAMPTZ(6);
ALTER TABLE "Claim" ALTER COLUMN "claimant_id" DROP NOT NULL;
ALTER TABLE "Claim" ALTER COLUMN "respondent_id" DROP NOT NULL;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenant_shape" CHECK (
  ("tenant_id" IS NULL AND "claimant_id" IS NOT NULL AND "respondent_id" IS NOT NULL AND "side" IS NULL)
  OR ("tenant_id" IS NOT NULL AND "claimant_id" IS NULL AND "respondent_id" IS NULL AND "opened_by" IS NOT NULL AND "opened_at" IS NOT NULL
      AND length(btrim("description")) >= 3
      AND (("side" = 'CUSTOMER' AND "sales_shipment_id" IS NOT NULL AND "customer_master_id" IS NOT NULL AND "supplier_master_id" IS NULL)
        OR ("side" = 'SUPPLIER' AND "supplier_shipment_id" IS NOT NULL AND "supplier_master_id" IS NOT NULL AND "customer_master_id" IS NULL))
      AND ("amount" IS NULL OR ("amount" >= 0 AND "currency" IS NOT NULL))
      AND ("quantity" IS NULL OR "quantity" > 0)
      AND ("settled_amount" IS NULL OR ("settled_amount" >= 0 AND "currency" IS NOT NULL))));
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_customer_master_fkey" FOREIGN KEY ("customer_master_id", "tenant_id") REFERENCES "Customer"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_supplier_master_fkey" FOREIGN KEY ("supplier_master_id", "tenant_id") REFERENCES "Supplier"("id", "tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "Claim_tenant_project_idx" ON "Claim"("tenant_id", "project_id", "state");

ALTER TABLE "ClaimOutcomeProposal"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "amount" DECIMAL(20, 6),
  ADD COLUMN "proposed_by" UUID,
  ADD COLUMN "proposed_at" TIMESTAMPTZ(6);
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "ClaimOutcomeProposal_tenant_shape" CHECK (
  "tenant_id" IS NULL OR ("proposed_by" IS NOT NULL AND "proposed_at" IS NOT NULL AND length(btrim("reason")) >= 3
    AND (("proposed_outcome" = 'RESOLVED' AND "amount" IS NOT NULL AND "amount" >= 0) OR ("proposed_outcome" = 'REJECTED' AND "amount" IS NULL))));
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "ClaimOutcomeProposal_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ClaimOutcomeProposal" ADD CONSTRAINT "ClaimOutcomeProposal_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- One live proposal per claim.
CREATE UNIQUE INDEX "ClaimOutcomeProposal_one_pending" ON "ClaimOutcomeProposal"("claim_id") WHERE "state" = 'PENDING_APPROVAL';

-- ---------------- closure ----------------
ALTER TABLE "ClosureAssessment"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "assessed_by" UUID;
ALTER TABLE "ClosureAssessment" ADD CONSTRAINT "ClosureAssessment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ClosureAssessment" ADD CONSTRAINT "ClosureAssessment_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "ClosureAssessment_project_idx" ON "ClosureAssessment"("project_id", "assessed_at");

ALTER TABLE "ClosureBlocker"
  ADD COLUMN "exception_reason" TEXT,
  ADD COLUMN "exception_by" UUID,
  ADD COLUMN "exception_at" TIMESTAMPTZ(6);
ALTER TABLE "ClosureBlocker" ADD CONSTRAINT "ClosureBlocker_exception_shape" CHECK (
  "exception_reason" IS NULL OR ("exception_eligible" AND length(btrim("exception_reason")) >= 3 AND "exception_by" IS NOT NULL AND "exception_at" IS NOT NULL));
ALTER TABLE "ClosureBlocker" ADD CONSTRAINT "ClosureBlocker_exception_by_fkey" FOREIGN KEY ("exception_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "Project"
  ADD COLUMN "closed_at" TIMESTAMPTZ(6),
  ADD COLUMN "closed_by" UUID,
  ADD COLUMN "closure_assessment_id" UUID,
  ADD COLUMN "reopened_at" TIMESTAMPTZ(6),
  ADD COLUMN "reopened_by" UUID,
  ADD COLUMN "reopen_reason" TEXT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_closure_shape" CHECK (
  "final_state" <> 'FINAL_CLOSED' OR "tenant_id" IS NULL OR ("closed_at" IS NOT NULL AND "closed_by" IS NOT NULL AND "closure_assessment_id" IS NOT NULL));
ALTER TABLE "Project" ADD CONSTRAINT "Project_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Project" ADD CONSTRAINT "Project_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Project" ADD CONSTRAINT "Project_closure_assessment_fkey" FOREIGN KEY ("closure_assessment_id") REFERENCES "ClosureAssessment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- A finally closed project is read-only for its trade records.
CREATE FUNCTION orb_deny_closed_project() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Project" p WHERE p."id" = NEW."project_id" AND p."final_state" = 'FINAL_CLOSED') THEN
    RAISE EXCEPTION 'ORB_PROJECT_CLOSED: project % is closed', NEW."project_id" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "SalesShipment_open_project" BEFORE INSERT OR UPDATE ON "SalesShipment" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "SupplierShipment_open_project" BEFORE INSERT OR UPDATE ON "SupplierShipment" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "SalesInvoice_open_project" BEFORE INSERT OR UPDATE ON "SalesInvoice" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "SupplierInvoice_open_project" BEFORE INSERT OR UPDATE ON "SupplierInvoice" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "MoneyMovement_open_project" BEFORE INSERT OR UPDATE ON "MoneyMovement" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "DirectExpense_open_project" BEFORE INSERT OR UPDATE ON "DirectExpense" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
CREATE TRIGGER "Claim_open_project" BEFORE INSERT OR UPDATE ON "Claim" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();

-- ---------------- audit ----------------
CREATE TABLE "ClaimClosureAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "project_id" UUID NOT NULL,
 "subject_type" TEXT NOT NULL,
 "subject_id" UUID NOT NULL,
 "actor_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT "ClaimClosureAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ClaimClosureAuditEvent_subject_allowed" CHECK ("subject_type" IN ('CLAIM', 'CLOSURE')),
 CONSTRAINT "ClaimClosureAuditEvent_action_allowed" CHECK ("action" IN ('OPENED', 'UNDER_REVIEW', 'OUTCOME_SUBMITTED', 'APPROVED', 'REJECTED', 'APPLIED', 'ASSESSED', 'EXCEPTION_RECORDED', 'CLOSE_SUBMITTED', 'CLOSED', 'REOPEN_SUBMITTED', 'REOPENED'))
);
CREATE INDEX "ClaimClosureAuditEvent_project_idx" ON "ClaimClosureAuditEvent"("tenant_id", "project_id", "occurred_at");
ALTER TABLE "ClaimClosureAuditEvent" ADD CONSTRAINT "ClaimClosureAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ClaimClosureAuditEvent" ADD CONSTRAINT "ClaimClosureAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "ClaimClosureAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "ClaimClosureAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();
CREATE TRIGGER "Contract_open_project" BEFORE INSERT OR UPDATE ON "Contract" FOR EACH ROW EXECUTE FUNCTION orb_deny_closed_project();
