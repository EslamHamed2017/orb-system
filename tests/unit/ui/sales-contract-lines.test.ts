import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateSalesContractSummary,
  validateSalesContractLines,
  type SalesContractLineDraft,
} from "../../../src/ui/features/contracts/sales-contract-lines.ts";

const lines: SalesContractLineDraft[] = [
  { id: "line-1", productId: "ethiopia", productName: "Ethiopia Guji", quantity: "6000", unit: "kg", unitPrice: "5.25", currency: "USD", incoterm: "FOB", namedPlace: "Djibouti", paymentTerms: "Net 30", documentTerms: "Original documents" },
  { id: "line-2", productId: "kenya", productName: "Kenya AA", quantity: "4500", unit: "kg", unitPrice: "6.10", currency: "USD", incoterm: "CIF", namedPlace: "Dubai", paymentTerms: "Net 30", documentTerms: "Original documents" },
];

test("multi-line sales contract summary uses exact decimal arithmetic", () => {
  assert.deepEqual(calculateSalesContractSummary(lines), {
    lineCount: 2,
    totalQuantity: "10500",
    unit: "kg",
    totalsByCurrency: [{ currency: "USD", amount: "58950" }],
  });
});

test("sales contract lines require products, positive quantities/prices and one quantity unit", () => {
  assert.deepEqual(validateSalesContractLines(lines), []);
  assert.deepEqual(validateSalesContractLines([]), ["LINES_REQUIRED"]);
  assert.deepEqual(validateSalesContractLines([{ ...lines[0], quantity: "0" }, { ...lines[1], unit: "MT" }]), [
    "QUANTITY_MUST_BE_POSITIVE:line-1",
    "MIXED_QUANTITY_UNITS",
  ]);
});

test("sales contracts page composes bilingual editable lines and approved detail", () => {
  const page = readFileSync("src/app/projects/[id]/contracts/page.tsx", "utf8");
  const component = readFileSync("src/ui/features/contracts/SalesContractLines.tsx", "utf8");
  assert.match(page, /SalesContractLines/);
  assert.match(component, /Add line/);
  assert.match(component, /إضافة بند/);
  assert.match(component, /Contract lines/);
  assert.match(component, /بنود العقد/);
  assert.match(component, /Remaining quantity/);
  assert.match(component, /الكمية المتبقية/);
  assert.match(component, /data-operation-id="createContractLine"/);
  assert.match(component, /readOnly/);
});
