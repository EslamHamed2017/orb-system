import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculatePurchaseContractSummary,
  validatePurchaseContractLines,
  type PurchaseContractLineDraft,
} from "../../../src/ui/features/contracts/purchase-contract-lines.ts";

const lines: PurchaseContractLineDraft[] = [
  { id: "line-1", productId: "ethiopia", productName: "Ethiopia Guji", quantity: "6000", unit: "kg", unitPrice: "4.15", currency: "USD", incoterm: "FOB", namedPlace: "Djibouti", paymentTerms: "Net 30", documentTerms: "Original documents" },
  { id: "line-2", productId: "kenya", productName: "Kenya AA", quantity: "1250", unit: "kg", unitPrice: "5.05", currency: "USD", incoterm: "CFR", namedPlace: "Dubai", paymentTerms: "Net 30", documentTerms: "Original documents" },
];

test("multi-line purchase contract summary uses exact decimal arithmetic", () => {
  assert.deepEqual(calculatePurchaseContractSummary(lines), {
    lineCount: 2,
    totalQuantity: "7250",
    unit: "kg",
    totalsByCurrency: [{ currency: "USD", amount: "31212.5" }],
  });
});

test("purchase contract lines require products, positive quantities and prices, valid currency, and one quantity unit", () => {
  assert.deepEqual(validatePurchaseContractLines(lines), []);
  assert.deepEqual(validatePurchaseContractLines([]), ["LINES_REQUIRED"]);
  assert.deepEqual(validatePurchaseContractLines([{ ...lines[0], productId: "", unitPrice: "0", currency: "usd" }, { ...lines[1], unit: "MT" }]), [
    "PRODUCT_REQUIRED:line-1",
    "UNIT_PRICE_MUST_BE_POSITIVE:line-1",
    "CURRENCY_INVALID:line-1",
    "MIXED_QUANTITY_UNITS",
  ]);
});

test("purchase contracts page composes supplier-attributable bilingual editable lines and approved detail", () => {
  const page = readFileSync("src/app/projects/[id]/contracts/page.tsx", "utf8");
  const component = readFileSync("src/ui/features/contracts/PurchaseContractLines.tsx", "utf8");
  assert.match(page, /PurchaseContractLines/);
  assert.match(page, /Arbor Export/);
  assert.match(page, /Blue Nile Trading/);
  assert.match(component, /Add purchase line/);
  assert.match(component, /إضافة بند شراء/);
  assert.match(component, /Purchase contract lines/);
  assert.match(component, /بنود عقد الشراء/);
  assert.match(component, /data-operation-id="createContractLine"/);
  assert.match(component, /readOnly/);
});
