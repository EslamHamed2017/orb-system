-- Deterministic 1:1 migration of Release 1 single-line records.
-- Safe to rerun before cutover: source IDs are reused as deterministic target IDs.
BEGIN;

ALTER TABLE "ContractLineVersion"
  ADD COLUMN IF NOT EXISTS "hash_version" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "line_hash" CHAR(64);
ALTER TABLE "SalesShipmentDatasetLine"
  ADD COLUMN IF NOT EXISTS "hash_version" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "line_hash" CHAR(64);
ALTER TABLE "SupplierShipmentDatasetLine"
  ADD COLUMN IF NOT EXISTS "hash_version" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "line_hash" CHAR(64);

-- V2 canonical line hash: lowercase SHA-256 of PostgreSQL jsonb's stable UTF-8
-- representation. Payload keys and the explicit hashVersion are part of the contract.
CREATE OR REPLACE FUNCTION orb_line_hash_v2(payload JSONB) RETURNS CHAR(64)
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
RETURN encode(digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex')::CHAR(64);

-- A Release 1 contract has one logical line across all of its immutable versions.
-- Reusing contract/version IDs makes the mapping deterministic without an ID map table.
INSERT INTO "ContractLine" ("id", "contract_id", "line_no")
SELECT c."id", c."id", 1
FROM "Contract" c
WHERE EXISTS (SELECT 1 FROM "ContractVersion" cv WHERE cv."contract_id" = c."id")
ON CONFLICT ("contract_id", "line_no") DO NOTHING;

INSERT INTO "ContractLineVersion" (
  "id", "contract_id", "contract_line_id", "contract_version_id",
  "coffee_specification_id", "quantity", "unit_price", "currency", "incoterm",
  "named_place", "quantity_tolerance_under", "quantity_tolerance_over",
  "payment_terms", "document_terms", "hash_version", "line_hash"
)
SELECT cv."id", cv."contract_id", cv."contract_id", cv."id",
  cv."coffee_specification_id", cv."quantity", cv."unit_price", cv."currency",
  cv."incoterm", cv."named_place", cv."quantity_tolerance_under",
  cv."quantity_tolerance_over", cv."payment_terms", cv."document_terms", 2,
  orb_line_hash_v2(jsonb_build_object(
    'hashVersion', 2, 'entity', 'contractLineVersion',
    'contractId', cv."contract_id"::text, 'contractLineId', cv."contract_id"::text,
    'contractVersionId', cv."id"::text, 'coffeeSpecificationId', cv."coffee_specification_id"::text,
    'quantity', cv."quantity", 'unitPrice', cv."unit_price", 'currency', cv."currency"::text,
    'incoterm', cv."incoterm", 'namedPlace', cv."named_place",
    'quantityToleranceUnder', cv."quantity_tolerance_under",
    'quantityToleranceOver', cv."quantity_tolerance_over",
    'paymentTerms', cv."payment_terms", 'documentTerms', cv."document_terms"
  ))
FROM "ContractVersion" cv
ON CONFLICT ("contract_version_id", "contract_line_id") DO UPDATE SET
  "coffee_specification_id" = EXCLUDED."coffee_specification_id",
  "quantity" = EXCLUDED."quantity", "unit_price" = EXCLUDED."unit_price",
  "currency" = EXCLUDED."currency", "incoterm" = EXCLUDED."incoterm",
  "named_place" = EXCLUDED."named_place",
  "quantity_tolerance_under" = EXCLUDED."quantity_tolerance_under",
  "quantity_tolerance_over" = EXCLUDED."quantity_tolerance_over",
  "payment_terms" = EXCLUDED."payment_terms", "document_terms" = EXCLUDED."document_terms",
  "hash_version" = EXCLUDED."hash_version", "line_hash" = EXCLUDED."line_hash";

-- Legacy shipment datasets did not bind a contract version. Select deterministically:
-- active version first, then approved revision, then latest revision. Existing v1
-- dataset_hash and Approval.subject_hash values are deliberately never changed.
INSERT INTO "SalesShipmentDatasetLine" (
  "id", "sales_shipment_dataset_id", "sales_contract_id", "line_no",
  "contract_line_version_id", "product_description",
  "customer_purchase_order_reference", "marks_and_numbers", "quantity",
  "bag_count", "bag_weight", "net_weight", "gross_weight", "hash_version", "line_hash"
)
SELECT d."id", d."id", d."sales_contract_id", 1, chosen."id",
  d."product_description", d."customer_purchase_order_reference", d."marks_and_numbers",
  d."quantity", d."bag_count", d."bag_weight", d."net_weight", d."gross_weight", 2,
  orb_line_hash_v2(jsonb_build_object(
    'hashVersion', 2, 'entity', 'salesShipmentDatasetLine',
    'salesShipmentDatasetId', d."id"::text, 'salesContractId', d."sales_contract_id"::text,
    'lineNo', 1, 'contractLineVersionId', chosen."id"::text,
    'productDescription', d."product_description",
    'customerPurchaseOrderReference', d."customer_purchase_order_reference",
    'marksAndNumbers', d."marks_and_numbers", 'quantity', d."quantity",
    'bagCount', d."bag_count", 'bagWeight', d."bag_weight",
    'netWeight', d."net_weight", 'grossWeight', d."gross_weight"
  ))
FROM "SalesShipmentDataset" d
JOIN "Contract" c ON c."id" = d."sales_contract_id"
JOIN LATERAL (
  SELECT cv."id"
  FROM "ContractVersion" cv
  WHERE cv."contract_id" = d."sales_contract_id"
  ORDER BY (cv."id" = c."active_version_id") DESC,
           (cv."state" = 'APPROVED'::"ContractVersionState") DESC,
           cv."revision_no" DESC, cv."id" DESC
  LIMIT 1
) chosen ON TRUE
ON CONFLICT ("sales_shipment_dataset_id", "line_no") DO UPDATE SET
  "contract_line_version_id" = EXCLUDED."contract_line_version_id",
  "product_description" = EXCLUDED."product_description",
  "customer_purchase_order_reference" = EXCLUDED."customer_purchase_order_reference",
  "marks_and_numbers" = EXCLUDED."marks_and_numbers", "quantity" = EXCLUDED."quantity",
  "bag_count" = EXCLUDED."bag_count", "bag_weight" = EXCLUDED."bag_weight",
  "net_weight" = EXCLUDED."net_weight", "gross_weight" = EXCLUDED."gross_weight",
  "hash_version" = EXCLUDED."hash_version", "line_hash" = EXCLUDED."line_hash";

INSERT INTO "SupplierShipmentDatasetLine" (
  "id", "supplier_shipment_dataset_id", "purchase_contract_id", "supplier_id",
  "line_no", "contract_line_version_id", "supplier_lot_reference", "quantity",
  "bag_count", "bag_weight", "net_weight", "gross_weight", "hash_version", "line_hash"
)
SELECT d."id", d."id", d."purchase_contract_id", d."supplier_id", 1, chosen."id",
  d."supplier_lot_reference", d."quantity", d."bag_count", d."bag_weight",
  d."net_weight", d."gross_weight", 2,
  orb_line_hash_v2(jsonb_build_object(
    'hashVersion', 2, 'entity', 'supplierShipmentDatasetLine',
    'supplierShipmentDatasetId', d."id"::text,
    'purchaseContractId', d."purchase_contract_id"::text, 'supplierId', d."supplier_id"::text,
    'lineNo', 1, 'contractLineVersionId', chosen."id"::text,
    'supplierLotReference', d."supplier_lot_reference", 'quantity', d."quantity",
    'bagCount', d."bag_count", 'bagWeight', d."bag_weight",
    'netWeight', d."net_weight", 'grossWeight', d."gross_weight"
  ))
FROM "SupplierShipmentDataset" d
JOIN "Contract" c ON c."id" = d."purchase_contract_id"
JOIN LATERAL (
  SELECT cv."id"
  FROM "ContractVersion" cv
  WHERE cv."contract_id" = d."purchase_contract_id"
  ORDER BY (cv."id" = c."active_version_id") DESC,
           (cv."state" = 'APPROVED'::"ContractVersionState") DESC,
           cv."revision_no" DESC, cv."id" DESC
  LIMIT 1
) chosen ON TRUE
ON CONFLICT ("supplier_shipment_dataset_id", "line_no") DO UPDATE SET
  "purchase_contract_id" = EXCLUDED."purchase_contract_id",
  "supplier_id" = EXCLUDED."supplier_id",
  "contract_line_version_id" = EXCLUDED."contract_line_version_id",
  "supplier_lot_reference" = EXCLUDED."supplier_lot_reference",
  "quantity" = EXCLUDED."quantity", "bag_count" = EXCLUDED."bag_count",
  "bag_weight" = EXCLUDED."bag_weight", "net_weight" = EXCLUDED."net_weight",
  "gross_weight" = EXCLUDED."gross_weight", "hash_version" = EXCLUDED."hash_version",
  "line_hash" = EXCLUDED."line_hash";

ALTER TABLE "ContractLineVersion" ALTER COLUMN "line_hash" SET NOT NULL;
ALTER TABLE "SalesShipmentDatasetLine" ALTER COLUMN "line_hash" SET NOT NULL;
ALTER TABLE "SupplierShipmentDatasetLine" ALTER COLUMN "line_hash" SET NOT NULL;

-- Reconciliation stays queryable during dual-read rollout. Values are partitioned
-- by currency; zero deltas are required before comparison reads are enabled.
CREATE OR REPLACE VIEW orb_concept_realignment_reconciliation AS
SELECT 'contract_version'::text AS entity, cv."currency"::text AS currency,
  count(*)::bigint AS legacy_rows, count(clv.*)::bigint AS v2_rows,
  coalesce(sum(cv."quantity"), 0)::numeric AS legacy_quantity,
  coalesce(sum(clv."quantity"), 0)::numeric AS v2_quantity,
  coalesce(sum(cv."quantity" * cv."unit_price"), 0)::numeric AS legacy_value,
  coalesce(sum(clv."quantity" * clv."unit_price"), 0)::numeric AS v2_value
FROM "ContractVersion" cv
LEFT JOIN "ContractLineVersion" clv ON clv."id" = cv."id"
GROUP BY cv."currency"
UNION ALL
SELECT 'sales_shipment_dataset', clv."currency"::text,
  count(*)::bigint, count(line.*)::bigint,
  coalesce(sum(d."quantity"), 0)::numeric, coalesce(sum(line."quantity"), 0)::numeric,
  coalesce(sum(d."quantity" * clv."unit_price"), 0)::numeric,
  coalesce(sum(line."quantity" * clv."unit_price"), 0)::numeric
FROM "SalesShipmentDataset" d
LEFT JOIN "SalesShipmentDatasetLine" line ON line."id" = d."id"
LEFT JOIN "ContractLineVersion" clv ON clv."id" = line."contract_line_version_id"
GROUP BY clv."currency"
UNION ALL
SELECT 'supplier_shipment_dataset', clv."currency"::text,
  count(*)::bigint, count(line.*)::bigint,
  coalesce(sum(d."quantity"), 0)::numeric, coalesce(sum(line."quantity"), 0)::numeric,
  coalesce(sum(d."quantity" * clv."unit_price"), 0)::numeric,
  coalesce(sum(line."quantity" * clv."unit_price"), 0)::numeric
FROM "SupplierShipmentDataset" d
LEFT JOIN "SupplierShipmentDatasetLine" line ON line."id" = d."id"
LEFT JOIN "ContractLineVersion" clv ON clv."id" = line."contract_line_version_id"
GROUP BY clv."currency";

COMMIT;
