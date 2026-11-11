import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOMAIN_TERMINOLOGY, domainTerm } from "../../../src/platform/i18n/domain-terminology.ts";

const expected = {
  project: ["Project", "مشروع"],
  product: ["Product", "منتج"],
  salesContract: ["Sales contract", "عقد بيع"],
  purchaseContract: ["Purchase contract", "عقد شراء"],
  contractLine: ["Contract line", "بند عقد"],
  salesShipment: ["Sales shipment", "شحنة بيع"],
  supplierContainer: ["Supplier container", "حاوية موردين"],
  shipmentLine: ["Shipment line", "بند شحنة"],
  salesInvoice: ["Sales invoice", "فاتورة مبيعات"],
  supplierInvoice: ["Supplier invoice", "فاتورة مورد"],
  accounts: ["Accounts", "الحسابات"],
  collection: ["Collection", "تحصيل"],
  supplierPayment: ["Supplier payment", "دفعة مورد"],
  expense: ["Expense", "مصروف"],
  attachment: ["Attachment", "مرفق"],
  productMovement: ["Product movement", "حركة منتج"],
  remainingQuantity: ["Remaining quantity", "الكمية المتبقية"],
} as const;

test("approved domain concepts have exact English and Arabic terms", () => {
  assert.deepEqual(Object.keys(DOMAIN_TERMINOLOGY), Object.keys(expected));
  for (const [concept, [english, arabic]] of Object.entries(expected)) {
    assert.equal(domainTerm(concept as keyof typeof expected, "en"), english);
    assert.equal(domainTerm(concept as keyof typeof expected, "ar"), arabic);
  }
});

test("sales shipment and multi-supplier physical container remain distinct concepts", () => {
  assert.equal(DOMAIN_TERMINOLOGY.salesShipment.definition,
    "Customer-facing fulfillment movement against approved sales-contract lines.");
  assert.equal(DOMAIN_TERMINOLOGY.supplierContainer.definition,
    "Physical inbound container that may consolidate approved purchase-contract lines from multiple suppliers.");
  assert.notEqual(domainTerm("salesShipment", "en"), domainTerm("supplierContainer", "en"));
  assert.notEqual(domainTerm("salesShipment", "ar"), domainTerm("supplierContainer", "ar"));
});

test("the domain catalog is immutable at runtime", () => {
  assert.equal(Object.isFrozen(DOMAIN_TERMINOLOGY), true);
  for (const term of Object.values(DOMAIN_TERMINOLOGY)) assert.equal(Object.isFrozen(term), true);
});

test("UI locale dictionaries consume the canonical domain catalog", () => {
  const enSource = readFileSync(resolve(import.meta.dirname, "../../../src/ui/i18n/en.ts"), "utf8");
  const arSource = readFileSync(resolve(import.meta.dirname, "../../../src/ui/i18n/ar.ts"), "utf8");
  for (const source of [enSource, arSource]) {
    assert.match(source, /import \{ localizedDomainTerms \} from "\.\.\/\.\.\/platform\/i18n\/domain-terminology";/);
  }
  assert.match(enSource, /domain: localizedDomainTerms\("en"\)/);
  assert.match(arSource, /domain: localizedDomainTerms\("ar"\)/);
});

test("the approved concept decision records the canonical bilingual vocabulary", () => {
  const decision = readFileSync(resolve(import.meta.dirname, "../../../docs/CONCEPT-DECISIONS-2026-11-10.md"), "utf8");
  for (const [concept, [english, arabic]] of Object.entries(expected)) {
    assert.ok(decision.includes(`| \`${concept}\` | ${english} | ${arabic} |`), `missing canonical row for ${concept}`);
  }
});
