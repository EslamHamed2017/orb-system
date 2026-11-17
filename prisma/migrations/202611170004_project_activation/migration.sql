BEGIN;
-- Add the explicit audited project lifecycle transition without weakening the action allow-list.
ALTER TABLE "ProjectAuditEvent" DROP CONSTRAINT IF EXISTS "ProjectAuditEvent_action_allowed";
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_action_allowed" CHECK (
  "action" IN ('PROJECT_CREATED','PROJECT_UPDATED','PROJECT_CANCELLED','PURCHASE_CONTRACT_CREATED','PROJECT_ACTIVATED')
);
COMMIT;
