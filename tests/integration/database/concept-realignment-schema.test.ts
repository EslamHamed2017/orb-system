import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const schema = readFileSync(resolve(ROOT, "prisma/schema.prisma"), "utf8");

function model(name: string): string {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match, `missing Prisma model ${name}`);
  return match[1];
}

function field(body: string, name: string): string {
  const match = body.match(new RegExp(`^\\s*${name}\\s+([^\\n]+)`, "m"));
  assert.ok(match, `missing field ${name}`);
  return match[1];
}

test("T007 models stable contract lines and immutable version facts without removing legacy fields", () => {
  const contract = model("Contract");
  const contractVersion = model("ContractVersion");
  const line = model("ContractLine");
  const lineVersion = model("ContractLineVersion");

  assert.match(field(line, "id"), /@id/);
  assert.match(field(line, "contract_id"), /@db\.Uuid/);
  assert.match(field(line, "line_no"), /Int/);
  assert.match(line, /@@unique\(\[contract_id, line_no\]\)/);
  assert.match(contract, /^\s*ContractLine\s+ContractLine\[\]/m);

  for (const name of [
    "contract_id", "contract_line_id", "contract_version_id", "coffee_specification_id",
    "quantity", "unit_price", "currency", "incoterm", "named_place",
    "quantity_tolerance_under", "quantity_tolerance_over", "payment_terms", "document_terms",
  ]) field(lineVersion, name);

  assert.match(field(lineVersion, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(lineVersion, "unit_price"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(lineVersion, /@@unique\(\[contract_version_id, contract_line_id\]\)/);
  assert.match(lineVersion, /fields: \[contract_line_id, contract_id\].+references: \[id, contract_id\]/);
  assert.match(lineVersion, /fields: \[contract_version_id, contract_id\].+references: \[id, contract_id\]/);
  assert.doesNotMatch(lineVersion, /^\s*(?:updated_at|version)\s+/m, "line-version facts are append-only, not edited in place");

  for (const legacy of [
    "coffee_specification_id", "quantity", "unit_price", "currency", "route", "incoterm", "named_place",
    "quantity_tolerance_under", "quantity_tolerance_over", "net_weight_tolerance_under",
    "net_weight_tolerance_over", "gross_weight_tolerance_under", "gross_weight_tolerance_over",
    "payment_terms", "document_terms",
  ]) field(contractVersion, legacy);
  assert.match(contractVersion, /^\s*ContractLineVersion\s+ContractLineVersion\[\]/m);
});

test("T008 models immutable sales shipment lines tied to exact contract-line versions", () => {
  const dataset = model("SalesShipmentDataset");
  const line = model("SalesShipmentDatasetLine");
  const contractLineVersion = model("ContractLineVersion");

  for (const name of [
    "sales_shipment_dataset_id", "sales_contract_id", "line_no", "contract_line_version_id",
    "product_description", "customer_purchase_order_reference", "quantity", "bag_count", "bag_weight", "net_weight", "gross_weight", "marks_and_numbers",
  ]) field(line, name);

  assert.match(field(line, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "bag_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "net_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "gross_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(line, /@@unique\(\[sales_shipment_dataset_id, line_no\]\)/);
  assert.match(line, /fields: \[sales_shipment_dataset_id, sales_contract_id\].+references: \[id, sales_contract_id\]/);
  assert.match(line, /fields: \[contract_line_version_id, sales_contract_id\].+references: \[id, contract_id\]/);
  assert.match(dataset, /@@unique\(\[id, sales_contract_id\]\)/);
  assert.match(dataset, /^\s*SalesShipmentDatasetLine\s+SalesShipmentDatasetLine\[\]/m);
  assert.match(contractLineVersion, /^\s*SalesShipmentDatasetLine\s+SalesShipmentDatasetLine\[\]/m);
  assert.doesNotMatch(line, /^\s*(?:updated_at|version)\s+/m, "dataset-line facts are immutable within a dataset revision");

  for (const legacy of [
    "coffee_specification_id", "quantity", "bag_count", "bag_weight", "net_weight", "gross_weight", "marks_and_numbers",
  ]) field(dataset, legacy);
});

test("T009 models immutable supplier shipment lines tied to exact purchase contract-line versions", () => {
  const dataset = model("SupplierShipmentDataset");
  const line = model("SupplierShipmentDatasetLine");
  const contractLineVersion = model("ContractLineVersion");

  for (const name of [
    "supplier_shipment_dataset_id", "purchase_contract_id", "line_no", "contract_line_version_id",
    "supplier_lot_reference", "quantity", "bag_count", "bag_weight", "net_weight", "gross_weight",
  ]) field(line, name);

  assert.match(field(line, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "bag_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "net_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(line, "gross_weight"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(line, /@@unique\(\[supplier_shipment_dataset_id, line_no\]\)/);
  assert.match(line, /fields: \[supplier_shipment_dataset_id\].+references: \[id\]/);
  assert.match(line, /fields: \[contract_line_version_id, purchase_contract_id\].+references: \[id, contract_id\]/);
  assert.match(dataset, /@@unique\(\[id, purchase_contract_id\]\)/);
  assert.match(dataset, /^\s*SupplierShipmentDatasetLine\s+SupplierShipmentDatasetLine\[\]/m);
  assert.match(contractLineVersion, /^\s*SupplierShipmentDatasetLine\s+SupplierShipmentDatasetLine\[\]/m);
  assert.doesNotMatch(line, /^\s*(?:updated_at|version)\s+/m, "dataset-line facts are immutable within a dataset revision");

  for (const legacy of [
    "supplier_id", "coffee_specification_id", "supplier_lot_reference", "quantity", "bag_count", "bag_weight", "net_weight", "gross_weight",
  ]) field(dataset, legacy);
});

test("T010 treats supplier shipments as physical containers with line-owned supplier and purchase-contract attribution", () => {
  const container = model("SupplierShipment");
  const dataset = model("SupplierShipmentDataset");
  const line = model("SupplierShipmentDatasetLine");
  const contract = model("Contract");
  const party = model("Party");

  field(container, "project_id");
  field(container, "reference");
  field(container, "active_dataset_id");
  assert.match(schema, /Physical inbound container header[\s\S]+model SupplierShipment\s*\{/);

  field(line, "supplier_id");
  assert.match(line, /fields: \[supplier_shipment_dataset_id\].+references: \[id\]/,
    "container lines must not be coupled to the dataset legacy purchase contract");
  assert.match(line, /fields: \[purchase_contract_id, supplier_id\].+references: \[id, counterparty_id\]/,
    "the database must bind every purchase contract to the line supplier");
  assert.match(contract, /@@unique\(\[id, counterparty_id\]\)/);
  assert.match(contract, /^\s*SupplierShipmentDatasetLine\s+SupplierShipmentDatasetLine\[\]/m);
  assert.match(party, /^\s*SupplierShipmentDatasetLine\s+SupplierShipmentDatasetLine\[\]/m);

  for (const legacy of ["purchase_contract_id"]) field(container, legacy);
  for (const legacy of ["purchase_contract_id", "supplier_id"]) field(dataset, legacy);
});

test("T011 models immutable exact-decimal source allocations between shipment lines", () => {
  const allocation = model("ShipmentLineSourceAllocation");
  const salesLine = model("SalesShipmentDatasetLine");
  const supplierLine = model("SupplierShipmentDatasetLine");

  for (const name of [
    "sales_shipment_dataset_line_id", "supplier_shipment_dataset_line_id", "quantity", "created_at",
  ]) field(allocation, name);

  assert.match(field(allocation, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/,
    "fulfillment quantities must use exact fixed-scale decimals");
  assert.match(allocation, /fields: \[sales_shipment_dataset_line_id\].+references: \[id\]/);
  assert.match(allocation, /fields: \[supplier_shipment_dataset_line_id\].+references: \[id\]/);
  assert.match(allocation, /@@unique\(\[sales_shipment_dataset_line_id, supplier_shipment_dataset_line_id\]\)/,
    "concurrent retries must converge on one allocation per source/target pair");
  assert.match(allocation, /@@index\(\[supplier_shipment_dataset_line_id\]\)/);
  assert.match(salesLine, /^\s*ShipmentLineSourceAllocation\s+ShipmentLineSourceAllocation\[\]/m);
  assert.match(supplierLine, /^\s*ShipmentLineSourceAllocation\s+ShipmentLineSourceAllocation\[\]/m);
  assert.doesNotMatch(allocation, /^\s*(?:updated_at|version)\s+/m,
    "allocation facts are append-only; corrections create a replacement dataset revision");
});

test("T012 models one active customer sales invoice per sales shipment with line traceability", () => {
  const invoice = model("SalesInvoice");
  const invoiceLine = model("SalesInvoiceLine");
  const shipment = model("SalesShipment");
  const project = model("Project");
  const dataset = model("SalesShipmentDataset");
  const shipmentLine = model("SalesShipmentDatasetLine");

  for (const name of [
    "project_id", "sales_shipment_id", "sales_shipment_dataset_id", "customer_id",
    "reference", "invoice_date", "currency", "state", "version",
  ]) field(invoice, name);

  assert.match(invoice, /fields: \[project_id, customer_id\].+references: \[id, customer_id\]/,
    "the invoice customer must be the project customer");
  assert.match(project, /@@unique\(\[id, customer_id\]\)/);
  assert.match(invoice, /fields: \[sales_shipment_id, project_id\].+references: \[id, project_id\]/,
    "the invoice shipment must belong to the same project");
  assert.match(invoice, /fields: \[sales_shipment_dataset_id, sales_shipment_id\].+references: \[id, shipment_id\]/,
    "the invoice must bind the exact dataset revision of its shipment");
  assert.match(invoice, /@@unique\(\[sales_shipment_id\].+where: raw\("\(state <> 'CANCELLED'::\\\"SalesInvoiceState\\\"\)"\)/,
    "only one non-cancelled customer invoice may exist for a sales shipment");
  assert.match(invoice, /@@unique\(\[customer_id, reference\]\)/);
  assert.match(shipment, /^\s*SalesInvoice\s+SalesInvoice\[\]/m);
  assert.match(dataset, /@@unique\(\[id, shipment_id\]\)/);

  for (const name of [
    "sales_invoice_id", "sales_shipment_dataset_id", "sales_shipment_dataset_line_id",
    "line_no", "description", "quantity", "unit_price", "line_amount", "created_at",
  ]) field(invoiceLine, name);

  assert.match(field(invoiceLine, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(invoiceLine, "unit_price"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(invoiceLine, "line_amount"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(invoiceLine, /fields: \[sales_invoice_id, sales_shipment_dataset_id\].+references: \[id, sales_shipment_dataset_id\]/,
    "invoice lines must use the dataset revision bound to their invoice");
  assert.match(invoiceLine, /fields: \[sales_shipment_dataset_line_id, sales_shipment_dataset_id\].+references: \[id, sales_shipment_dataset_id\]/,
    "invoice lines must trace to exact lines from that shipment dataset");
  assert.match(invoiceLine, /@@unique\(\[sales_invoice_id, line_no\]\)/);
  assert.match(invoiceLine, /@@unique\(\[sales_invoice_id, sales_shipment_dataset_line_id\]\)/);
  assert.match(shipmentLine, /@@unique\(\[id, sales_shipment_dataset_id\]\)/);
  assert.match(shipmentLine, /^\s*SalesInvoiceLine\s+SalesInvoiceLine\[\]/m);
});

test("T013 models supplier invoice lines with database-enforced same-supplier container attribution", () => {
  const invoice = model("SupplierInvoice");
  const invoiceLine = model("SupplierInvoiceLine");
  const dataset = model("SupplierShipmentDataset");
  const shipmentLine = model("SupplierShipmentDatasetLine");

  for (const name of [
    "supplier_invoice_id", "supplier_shipment_id", "supplier_shipment_dataset_id",
    "supplier_shipment_dataset_line_id", "supplier_id", "line_no", "description",
    "quantity", "unit_price", "line_amount", "created_at",
  ]) field(invoiceLine, name);

  assert.match(field(invoiceLine, "quantity"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(invoiceLine, "unit_price"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(field(invoiceLine, "line_amount"), /Decimal.+@db\.Decimal\(20, 6\)/);
  assert.match(invoice, /@@unique\(\[id, supplier_id, supplier_shipment_id\]\)/);
  assert.match(invoiceLine, /fields: \[supplier_invoice_id, supplier_id, supplier_shipment_id\].+references: \[id, supplier_id, supplier_shipment_id\]/,
    "every invoice line must inherit the invoice supplier and physical container");
  assert.match(invoiceLine, /fields: \[supplier_shipment_dataset_id, supplier_shipment_id\].+references: \[id, shipment_id\]/,
    "every invoice line must resolve within a dataset revision of the invoice container");
  assert.match(invoiceLine, /fields: \[supplier_shipment_dataset_line_id, supplier_shipment_dataset_id, supplier_id\].+references: \[id, supplier_shipment_dataset_id, supplier_id\]/,
    "the invoiced container line must belong to the invoice supplier");
  assert.match(invoiceLine, /@@unique\(\[supplier_invoice_id, line_no\]\)/);
  assert.match(invoiceLine, /@@unique\(\[supplier_invoice_id, supplier_shipment_dataset_line_id\]\)/);
  assert.match(dataset, /@@unique\(\[id, shipment_id\]\)/);
  assert.match(shipmentLine, /@@unique\(\[id, supplier_shipment_dataset_id, supplier_id\]\)/);
  assert.match(invoice, /^\s*SupplierInvoiceLine\s+SupplierInvoiceLine\[\]/m);
  assert.match(shipmentLine, /^\s*SupplierInvoiceLine\s+SupplierInvoiceLine\[\]/m);
  assert.doesNotMatch(invoiceLine, /^\s*(?:updated_at|version)\s+/m,
    "supplier invoice line facts are immutable; corrections replace the invoice");
});

test("T014 models an immutable generic transaction serial registry with collision-proof uniqueness", () => {
  const serial = model("TransactionSerial");
  const project = model("Project");
  const user = model("User");

  for (const name of [
    "project_id", "transaction_type", "subject_id", "serial", "series_key",
    "sequence_no", "allocated_at", "allocated_by",
  ]) field(serial, name);

  assert.match(field(serial, "transaction_type"), /TransactionType/,
    "serial subjects must use a closed transaction-type allowlist");
  assert.match(field(serial, "serial"), /String.+@unique/,
    "a printable serial must never identify two transactions anywhere in ORB");
  assert.match(serial, /@@unique\(\[transaction_type, subject_id\]\)/,
    "a transaction may receive only one immutable serial");
  assert.match(serial, /@@unique\(\[series_key, sequence_no\]\)/,
    "concurrent allocation in a numbering series must reject sequence collisions");
  assert.match(serial, /fields: \[project_id\].+references: \[id\]/,
    "every serial must retain its project scope for authorization and traceability");
  assert.match(serial, /fields: \[allocated_by\].+references: \[id\]/,
    "serial allocation must retain the responsible user");
  assert.match(project, /^\s*TransactionSerial\s+TransactionSerial\[\]/m);
  assert.match(user, /^\s*TransactionSerial\s+TransactionSerial\[\]/m);
  assert.doesNotMatch(serial, /^\s*(?:updated_at|version)\s+/m,
    "allocated serials are immutable registry facts");

  const type = schema.match(/enum\s+TransactionType\s*\{([\s\S]*?)\n\}/m);
  assert.ok(type, "missing closed TransactionType enum");
  for (const value of [
    "PROJECT", "SALES_CONTRACT", "PURCHASE_CONTRACT", "SALES_SHIPMENT",
    "SUPPLIER_CONTAINER", "SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION",
    "SUPPLIER_PAYMENT", "EXPENSE",
  ]) assert.match(type[1], new RegExp(`^\\s*${value}\\s*$`, "m"));
});

test("T015 scopes evidence to a project and records a closed subject plus authorization parent", () => {
  const evidence = model("EvidenceObject");
  const link = model("EvidenceLink");
  const project = model("Project");

  field(evidence, "project_id");
  assert.match(evidence, /fields: \[project_id\].+references: \[id\]/,
    "evidence objects must carry their authorization project directly");
  assert.match(evidence, /@@unique\(\[id, project_id\]\)/,
    "links need a composite evidence/project target to prevent cross-project attachment leaks");
  assert.match(project, /^\s*EvidenceObject\s+EvidenceObject\[\]/m);

  for (const name of [
    "evidence_id", "project_id", "subject_type", "subject_id",
    "authorization_parent_type", "authorization_parent_id", "purpose",
  ]) field(link, name);
  assert.match(field(link, "subject_type"), /EvidenceSubjectType/,
    "source subjects must use a closed allowlist");
  assert.match(field(link, "authorization_parent_type"), /EvidenceSubjectType/,
    "the parent used for access decisions must use the same closed allowlist");
  assert.match(link, /fields: \[evidence_id, project_id\].+references: \[id, project_id\]/,
    "an evidence link cannot claim a project different from its object");
  assert.match(link, /@@index\(\[project_id, authorization_parent_type, authorization_parent_id\]\)/,
    "parent authorization lookups must be project-scoped and indexed");

  const subjectType = schema.match(/enum\s+EvidenceSubjectType\s*\{([\s\S]*?)\n\}/m);
  assert.ok(subjectType, "missing closed EvidenceSubjectType enum");
  for (const value of [
    "PROJECT", "CONTRACT", "SALES_SHIPMENT", "SUPPLIER_CONTAINER", "SALES_INVOICE",
    "SUPPLIER_INVOICE", "MONEY_MOVEMENT", "EXPENSE", "CLAIM", "COMMERCIAL_DOCUMENT",
    "ROUTE_CHECKLIST_ITEM", "APPROVAL",
  ]) assert.match(subjectType[1], new RegExp(`^\\s*${value}\\s*$`, "m"));
});
