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
