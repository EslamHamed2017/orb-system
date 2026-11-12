import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("collections, supplier payments, and expenses expose bilingual attributed print outputs", () => {
  const document = readFileSync("src/ui/features/accounts/OperationalTransactionPrintDocument.tsx", "utf8");
  const movements = readFileSync("src/ui/features/accounts/ProjectMoneyMovementsPage.tsx", "utf8");
  const expenses = readFileSync("src/ui/features/accounts/ProjectExpensesPage.tsx", "utf8");
  const action = readFileSync("src/ui/features/printing/PrintAction.tsx", "utf8");

  assert.match(movements, /OperationalTransactionPrintDocument/);
  assert.match(expenses, /OperationalTransactionPrintDocument/);
  assert.match(document, /data-print-document/);
  assert.match(document, /collection/);
  assert.match(document, /supplierPayment/);
  assert.match(document, /expense/);
  assert.match(document, /Customer/);
  assert.match(document, /العميل/);
  assert.match(document, /Supplier/);
  assert.match(document, /المورد/);
  assert.match(document, /Transaction scope/);
  assert.match(document, /نطاق المعاملة/);
  assert.match(document, /Source-currency amount/);
  assert.match(document, /المبلغ بعملة المصدر/);
  assert.match(action, /Print collection/);
  assert.match(action, /طباعة التحصيل/);
  assert.match(action, /Print supplier payment/);
  assert.match(action, /طباعة دفعة المورد/);
  assert.match(action, /Print expense/);
  assert.match(action, /طباعة المصروف/);
});
