BEGIN;

ALTER TABLE "SupplierShipment" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "SupplierShipment" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "purchase_contract_version_id" UUID;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "supplier_master_id" UUID;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "origin_unlocode" TEXT;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "load_country" CHAR(2);
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "load_unlocode" TEXT;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "discharge_country" CHAR(2);
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "discharge_unlocode" TEXT;
ALTER TABLE "SupplierShipmentDataset" ADD COLUMN "destination_unlocode" TEXT;
ALTER TABLE "SupplierShipmentDataset" ALTER COLUMN "supplier_id" DROP NOT NULL;

CREATE UNIQUE INDEX "SupplierShipment_id_tenant_id_key" ON "SupplierShipment"("id","tenant_id");
CREATE INDEX "SupplierShipment_tenant_id_project_id_execution_state_idx" ON "SupplierShipment"("tenant_id","project_id","execution_state");
CREATE UNIQUE INDEX "SupplierShipmentDataset_id_tenant_id_key" ON "SupplierShipmentDataset"("id","tenant_id");
CREATE UNIQUE INDEX "ContractVersion_id_contract_id_tenant_id_key" ON "ContractVersion"("id","contract_id","tenant_id");
CREATE INDEX "SupplierShipmentDataset_supplier_master_id_tenant_id_idx" ON "SupplierShipmentDataset"("supplier_master_id","tenant_id");

ALTER TABLE "SupplierShipment" ADD CONSTRAINT "SupplierShipment_tenant_shape" CHECK (
 ("tenant_id" IS NULL AND "supplier_id" IS NULL) OR
 ("tenant_id" IS NOT NULL AND "supplier_id" IS NOT NULL)
);
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_tenant_shape" CHECK (
 ("tenant_id" IS NULL AND "supplier_id" IS NOT NULL AND "supplier_master_id" IS NULL) OR
 ("tenant_id" IS NOT NULL AND "supplier_id" IS NULL AND "supplier_master_id" IS NOT NULL AND "purchase_contract_version_id" IS NOT NULL AND "load_country" IS NOT NULL)
);
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_schedule_valid" CHECK (
 "estimated_departure" IS NULL OR "estimated_arrival" IS NULL OR "estimated_arrival" >= "estimated_departure"
);

ALTER TABLE "SupplierShipment" ADD CONSTRAINT "SupplierShipment_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "SupplierShipment_project_tenant_fkey" FOREIGN KEY ("project_id","tenant_id") REFERENCES "Project"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "SupplierShipment_contract_tenant_fkey" FOREIGN KEY ("purchase_contract_id","tenant_id") REFERENCES "Contract"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "SupplierShipment_supplier_tenant_fkey" FOREIGN KEY ("supplier_id","tenant_id") REFERENCES "Supplier"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_shipment_tenant_fkey" FOREIGN KEY ("shipment_id","tenant_id") REFERENCES "SupplierShipment"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_contract_tenant_fkey" FOREIGN KEY ("purchase_contract_id","tenant_id") REFERENCES "Contract"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_contract_version_tenant_fkey" FOREIGN KEY ("purchase_contract_version_id","purchase_contract_id","tenant_id") REFERENCES "ContractVersion"("id","contract_id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_supplier_tenant_fkey" FOREIGN KEY ("supplier_master_id","tenant_id") REFERENCES "Supplier"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "SupplierShipmentDataset" ADD CONSTRAINT "SupplierShipmentDataset_product_tenant_fkey" FOREIGN KEY ("coffee_specification_id","tenant_id") REFERENCES "CoffeeSpecification"("id","tenant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "SupplierShipment" DROP CONSTRAINT "fk_103_SupplierShipment";
ALTER TABLE "SupplierShipment" ADD CONSTRAINT "fk_103_SupplierShipment" FOREIGN KEY ("active_dataset_id","id") REFERENCES "SupplierShipmentDataset"("id","shipment_id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ProjectAuditEvent" DROP CONSTRAINT IF EXISTS "ProjectAuditEvent_action_allowed";
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_action_allowed" CHECK (
 "action" IN ('PROJECT_CREATED','PROJECT_UPDATED','PROJECT_CANCELLED','PURCHASE_CONTRACT_CREATED','PROJECT_ACTIVATED','SUPPLIER_SHIPMENT_CREATED')
);
ALTER TABLE "IdempotencyRecord" DROP CONSTRAINT IF EXISTS "IdempotencyRecord_purchase_response_snapshot";
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_tenant_response_snapshot" CHECK (
 "operation_id" NOT IN ('createPurchaseContract','createSupplierShipment') OR ("tenant_id" IS NOT NULL AND "response_body" IS NOT NULL)
);

COMMIT;
