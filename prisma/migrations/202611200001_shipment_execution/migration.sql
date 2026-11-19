-- Shipment execution on the database: append-only audit of every shipment command,
-- and idempotent execution events (one event per shipment per idempotency key).
CREATE TABLE "ShipmentAuditEvent" (
 "id" UUID NOT NULL DEFAULT orb_uuidv7(),
 "tenant_id" UUID NOT NULL,
 "project_id" UUID NOT NULL,
 "shipment_type" TEXT NOT NULL,
 "shipment_id" UUID NOT NULL,
 "actor_id" UUID NOT NULL,
 "action" TEXT NOT NULL,
 "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 CONSTRAINT "ShipmentAuditEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ShipmentAuditEvent_type_allowed" CHECK ("shipment_type" IN ('SUPPLIER','SALES')),
 CONSTRAINT "ShipmentAuditEvent_action_allowed" CHECK ("action" IN ('DATASET_REVISED','CONFIRMATION_SUBMITTED','CONFIRMATION_APPROVED','CONFIRMATION_REJECTED','STATE_CHANGED','PRIMARY_SOURCE_SET'))
);
CREATE INDEX "ShipmentAuditEvent_shipment_idx" ON "ShipmentAuditEvent"("shipment_type", "shipment_id", "occurred_at");
CREATE INDEX "ShipmentAuditEvent_tenant_id_occurred_at_idx" ON "ShipmentAuditEvent"("tenant_id", "occurred_at");
ALTER TABLE "ShipmentAuditEvent" ADD CONSTRAINT "ShipmentAuditEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ShipmentAuditEvent" ADD CONSTRAINT "ShipmentAuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TRIGGER "ShipmentAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "ShipmentAuditEvent" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation();

CREATE UNIQUE INDEX "ShipmentExecutionEvent_idempotency_key" ON "ShipmentExecutionEvent"("shipment_type", "shipment_id", "idempotency_key");
