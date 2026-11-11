-- ORB concept realignment expand migration.
-- Additive by policy: legacy columns stay readable by the preceding application release.
BEGIN;

-- CreateEnum
CREATE TYPE "PermissionCategory" AS ENUM ('SCREEN', 'OPERATION', 'SENSITIVE_VALUE', 'APPROVAL');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PROJECT', 'SALES_CONTRACT', 'PURCHASE_CONTRACT', 'SALES_SHIPMENT', 'SUPPLIER_CONTAINER', 'SALES_INVOICE', 'SUPPLIER_INVOICE', 'COLLECTION', 'SUPPLIER_PAYMENT', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EvidenceSubjectType" AS ENUM ('PROJECT', 'CONTRACT', 'SALES_SHIPMENT', 'SUPPLIER_CONTAINER', 'SALES_INVOICE', 'SUPPLIER_INVOICE', 'MONEY_MOVEMENT', 'EXPENSE', 'CLAIM', 'COMMERCIAL_DOCUMENT', 'ROUTE_CHECKLIST_ITEM', 'APPROVAL');

-- CreateEnum
CREATE TYPE "SalesInvoiceState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ISSUED', 'CANCELLED');

-- Expand existing evidence tables without rewriting or invalidating legacy rows.
-- T018 backfills these columns before a later contract migration validates requiredness.
ALTER TABLE "EvidenceLink"
ADD COLUMN "authorization_parent_id" UUID,
ADD COLUMN "authorization_parent_type" "EvidenceSubjectType",
ADD COLUMN "project_id" UUID;

ALTER TABLE "EvidenceObject" ADD COLUMN "project_id" UUID;

-- CreateTable
CREATE TABLE "ContractLine" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "contract_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLineVersion" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "contract_id" UUID NOT NULL,
    "contract_line_id" UUID NOT NULL,
    "contract_version_id" UUID NOT NULL,
    "coffee_specification_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_price" DECIMAL(20,6) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "incoterm" TEXT NOT NULL,
    "named_place" TEXT NOT NULL,
    "quantity_tolerance_under" DECIMAL NOT NULL DEFAULT 0,
    "quantity_tolerance_over" DECIMAL NOT NULL DEFAULT 0,
    "payment_terms" TEXT NOT NULL,
    "document_terms" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractLineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "project_id" UUID NOT NULL,
    "sales_shipment_id" UUID NOT NULL,
    "sales_shipment_dataset_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "state" "SalesInvoiceState" NOT NULL DEFAULT 'DRAFT',
    "approval_id" UUID,
    "cancellation_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "sales_invoice_id" UUID NOT NULL,
    "sales_shipment_dataset_id" UUID NOT NULL,
    "sales_shipment_dataset_line_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_price" DECIMAL(20,6) NOT NULL,
    "line_amount" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesShipmentDatasetLine" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "sales_shipment_dataset_id" UUID NOT NULL,
    "sales_contract_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "contract_line_version_id" UUID NOT NULL,
    "product_description" TEXT NOT NULL,
    "customer_purchase_order_reference" TEXT,
    "marks_and_numbers" TEXT,
    "quantity" DECIMAL(20,6) NOT NULL,
    "bag_count" INTEGER NOT NULL,
    "bag_weight" DECIMAL(20,6) NOT NULL,
    "net_weight" DECIMAL(20,6) NOT NULL,
    "gross_weight" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesShipmentDatasetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "supplier_invoice_id" UUID NOT NULL,
    "supplier_shipment_id" UUID NOT NULL,
    "supplier_shipment_dataset_id" UUID NOT NULL,
    "supplier_shipment_dataset_line_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_price" DECIMAL(20,6) NOT NULL,
    "line_amount" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierShipmentDatasetLine" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "supplier_shipment_dataset_id" UUID NOT NULL,
    "purchase_contract_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "contract_line_version_id" UUID NOT NULL,
    "supplier_lot_reference" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "bag_count" INTEGER NOT NULL,
    "bag_weight" DECIMAL(20,6) NOT NULL,
    "net_weight" DECIMAL(20,6) NOT NULL,
    "gross_weight" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierShipmentDatasetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLineSourceAllocation" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "sales_shipment_dataset_line_id" UUID NOT NULL,
    "supplier_shipment_dataset_line_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentLineSourceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSerial" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "project_id" UUID NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "serial" TEXT NOT NULL,
    "series_key" TEXT NOT NULL,
    "sequence_no" BIGINT NOT NULL,
    "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocated_by" UUID NOT NULL,

    CONSTRAINT "TransactionSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "category" "PermissionCategory" NOT NULL,
    "description_en" TEXT NOT NULL,
    "description_ar" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "description_ar" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" UUID NOT NULL DEFAULT orb_uuidv7(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractLine_id_contract_id_key" ON "ContractLine"("id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLine_contract_id_line_no_key" ON "ContractLine"("contract_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLineVersion_id_contract_id_key" ON "ContractLineVersion"("id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractLineVersion_contract_version_id_contract_line_id_key" ON "ContractLineVersion"("contract_version_id", "contract_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_id_sales_shipment_dataset_id_key" ON "SalesInvoice"("id", "sales_shipment_dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_customer_id_reference_key" ON "SalesInvoice"("customer_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "one_active_sales_invoice_per_shipment" ON "SalesInvoice"("sales_shipment_id") WHERE (state <> 'CANCELLED'::"SalesInvoiceState");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceLine_sales_invoice_id_line_no_key" ON "SalesInvoiceLine"("sales_invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceLine_sales_invoice_id_sales_shipment_dataset_li_key" ON "SalesInvoiceLine"("sales_invoice_id", "sales_shipment_dataset_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipmentDatasetLine_id_sales_shipment_dataset_id_key" ON "SalesShipmentDatasetLine"("id", "sales_shipment_dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipmentDatasetLine_sales_shipment_dataset_id_line_no_key" ON "SalesShipmentDatasetLine"("sales_shipment_dataset_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoiceLine_supplier_invoice_id_line_no_key" ON "SupplierInvoiceLine"("supplier_invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoiceLine_supplier_invoice_id_supplier_shipment_d_key" ON "SupplierInvoiceLine"("supplier_invoice_id", "supplier_shipment_dataset_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierShipmentDatasetLine_id_supplier_shipment_dataset_id_key" ON "SupplierShipmentDatasetLine"("id", "supplier_shipment_dataset_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierShipmentDatasetLine_supplier_shipment_dataset_id_li_key" ON "SupplierShipmentDatasetLine"("supplier_shipment_dataset_id", "line_no");

-- CreateIndex
CREATE INDEX "ShipmentLineSourceAllocation_supplier_shipment_dataset_line_idx" ON "ShipmentLineSourceAllocation"("supplier_shipment_dataset_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentLineSourceAllocation_sales_shipment_dataset_line_id_key" ON "ShipmentLineSourceAllocation"("sales_shipment_dataset_line_id", "supplier_shipment_dataset_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSerial_serial_key" ON "TransactionSerial"("serial");

-- CreateIndex
CREATE INDEX "TransactionSerial_project_id_transaction_type_idx" ON "TransactionSerial"("project_id", "transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSerial_transaction_type_subject_id_key" ON "TransactionSerial"("transaction_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSerial_series_key_sequence_no_key" ON "TransactionSerial"("series_key", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "RolePermission_permission_id_idx" ON "RolePermission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_id_permission_id_key" ON "RolePermission"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_role_id_idx" ON "UserRoleAssignment"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_user_id_role_id_key" ON "UserRoleAssignment"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_id_counterparty_id_key" ON "Contract"("id", "counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_id_contract_id_key" ON "ContractVersion"("id", "contract_id");

-- CreateIndex
CREATE INDEX "EvidenceLink_project_id_authorization_parent_type_authoriza_idx" ON "EvidenceLink"("project_id", "authorization_parent_type", "authorization_parent_id");

-- CreateIndex
CREATE INDEX "EvidenceLink_project_id_subject_type_subject_id_idx" ON "EvidenceLink"("project_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "EvidenceObject_project_id_idx" ON "EvidenceObject"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceObject_id_project_id_key" ON "EvidenceObject"("id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_customer_id_key" ON "Project"("id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipmentDataset_id_sales_contract_id_key" ON "SalesShipmentDataset"("id", "sales_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalesShipmentDataset_id_shipment_id_key" ON "SalesShipmentDataset"("id", "shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_id_supplier_id_supplier_shipment_id_key" ON "SupplierInvoice"("id", "supplier_id", "supplier_shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierShipmentDataset_id_purchase_contract_id_key" ON "SupplierShipmentDataset"("id", "purchase_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierShipmentDataset_id_shipment_id_key" ON "SupplierShipmentDataset"("id", "shipment_id");

-- AddForeignKey
ALTER TABLE "ContractLine" ADD CONSTRAINT "ContractLine_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContractLineVersion" ADD CONSTRAINT "ContractLineVersion_contract_line_id_contract_id_fkey" FOREIGN KEY ("contract_line_id", "contract_id") REFERENCES "ContractLine"("id", "contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContractLineVersion" ADD CONSTRAINT "ContractLineVersion_contract_version_id_contract_id_fkey" FOREIGN KEY ("contract_version_id", "contract_id") REFERENCES "ContractVersion"("id", "contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContractLineVersion" ADD CONSTRAINT "ContractLineVersion_coffee_specification_id_fkey" FOREIGN KEY ("coffee_specification_id") REFERENCES "CoffeeSpecification"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "Approval"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_project_id_customer_id_fkey" FOREIGN KEY ("project_id", "customer_id") REFERENCES "Project"("id", "customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_sales_shipment_id_project_id_fkey" FOREIGN KEY ("sales_shipment_id", "project_id") REFERENCES "SalesShipment"("id", "project_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_sales_shipment_dataset_id_sales_shipment_id_fkey" FOREIGN KEY ("sales_shipment_dataset_id", "sales_shipment_id") REFERENCES "SalesShipmentDataset"("id", "shipment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_sales_invoice_id_sales_shipment_dataset_i_fkey" FOREIGN KEY ("sales_invoice_id", "sales_shipment_dataset_id") REFERENCES "SalesInvoice"("id", "sales_shipment_dataset_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_sales_shipment_dataset_line_id_sales_ship_fkey" FOREIGN KEY ("sales_shipment_dataset_line_id", "sales_shipment_dataset_id") REFERENCES "SalesShipmentDatasetLine"("id", "sales_shipment_dataset_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesShipmentDatasetLine" ADD CONSTRAINT "SalesShipmentDatasetLine_sales_shipment_dataset_id_sales_c_fkey" FOREIGN KEY ("sales_shipment_dataset_id", "sales_contract_id") REFERENCES "SalesShipmentDataset"("id", "sales_contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SalesShipmentDatasetLine" ADD CONSTRAINT "SalesShipmentDatasetLine_contract_line_version_id_sales_co_fkey" FOREIGN KEY ("contract_line_version_id", "sales_contract_id") REFERENCES "ContractLineVersion"("id", "contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_supplier_invoice_id_supplier_id_suppli_fkey" FOREIGN KEY ("supplier_invoice_id", "supplier_id", "supplier_shipment_id") REFERENCES "SupplierInvoice"("id", "supplier_id", "supplier_shipment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_supplier_shipment_dataset_id_supplier__fkey" FOREIGN KEY ("supplier_shipment_dataset_id", "supplier_shipment_id") REFERENCES "SupplierShipmentDataset"("id", "shipment_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_supplier_shipment_dataset_line_id_supp_fkey" FOREIGN KEY ("supplier_shipment_dataset_line_id", "supplier_shipment_dataset_id", "supplier_id") REFERENCES "SupplierShipmentDatasetLine"("id", "supplier_shipment_dataset_id", "supplier_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierShipmentDatasetLine" ADD CONSTRAINT "SupplierShipmentDatasetLine_supplier_shipment_dataset_id_fkey" FOREIGN KEY ("supplier_shipment_dataset_id") REFERENCES "SupplierShipmentDataset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierShipmentDatasetLine" ADD CONSTRAINT "SupplierShipmentDatasetLine_purchase_contract_id_supplier__fkey" FOREIGN KEY ("purchase_contract_id", "supplier_id") REFERENCES "Contract"("id", "counterparty_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierShipmentDatasetLine" ADD CONSTRAINT "SupplierShipmentDatasetLine_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierShipmentDatasetLine" ADD CONSTRAINT "SupplierShipmentDatasetLine_contract_line_version_id_purch_fkey" FOREIGN KEY ("contract_line_version_id", "purchase_contract_id") REFERENCES "ContractLineVersion"("id", "contract_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShipmentLineSourceAllocation" ADD CONSTRAINT "ShipmentLineSourceAllocation_sales_shipment_dataset_line_i_fkey" FOREIGN KEY ("sales_shipment_dataset_line_id") REFERENCES "SalesShipmentDatasetLine"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShipmentLineSourceAllocation" ADD CONSTRAINT "ShipmentLineSourceAllocation_supplier_shipment_dataset_lin_fkey" FOREIGN KEY ("supplier_shipment_dataset_line_id") REFERENCES "SupplierShipmentDatasetLine"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TransactionSerial" ADD CONSTRAINT "TransactionSerial_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TransactionSerial" ADD CONSTRAINT "TransactionSerial_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


COMMIT;
