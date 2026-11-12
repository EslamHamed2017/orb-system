import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sales and purchase contracts expose bilingual targeted print output", () => {
  const page = readFileSync("src/app/projects/[id]/contracts/page.tsx", "utf8");
  const action = readFileSync("src/ui/features/printing/PrintAction.tsx", "utf8");
  const sales = readFileSync("src/ui/features/contracts/SalesContractLines.tsx", "utf8");
  const purchase = readFileSync("src/ui/features/contracts/PurchaseContractLines.tsx", "utf8");
  const styles = readFileSync("src/ui/features/shipments/operations.module.css", "utf8");

  assert.match(page, /PrintAction/);
  assert.match(page, /sales-contract-print/);
  assert.match(page, /purchase-contract-PC-0007-print/);
  assert.match(page, /purchase-contract-PC-0008-print/);
  assert.match(page, /data-print-document/);
  assert.match(action, /window\.print\(\)/);
  assert.match(action, /Print contract/);
  assert.match(action, /طباعة العقد/);
  assert.match(action, /afterprint/);
  assert.match(sales, /Incoterm/);
  assert.match(sales, /شروط التسليم/);
  assert.match(sales, /Payment terms/);
  assert.match(sales, /شروط الدفع/);
  assert.match(purchase, /Document terms/);
  assert.match(purchase, /شروط المستندات/);
  assert.match(styles, /@media print/);
  assert.match(styles, /orb-print-selected/);
  assert.match(styles, /break-inside:\s*avoid/);
});
