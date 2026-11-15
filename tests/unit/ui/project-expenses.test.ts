import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildExpenseListHref,
  filterProjectExpenses,
  type ExpenseListItem,
} from "../../../src/ui/features/accounts/project-expenses.ts";

const expenses: readonly ExpenseListItem[] = [
  { id: "expense-2", projectId: "project-2", scopeType: "PROJECT", occurredOn: "2026-11-12", state: "APPROVED", reference: "EXP-002", category: "INSURANCE", currency: "AED", amount: "700.000000" },
  { id: "expense-1", projectId: "project-1", scopeType: "SALES_SHIPMENT", scopeId: "sales-shipment-1", occurredOn: "2026-11-11", state: "APPROVED", reference: "EXP-001", category: "FREIGHT", currency: "USD", amount: "1000.000000" },
  { id: "expense-void", projectId: "project-1", scopeType: "PROJECT", occurredOn: "2026-11-13", state: "CANCELLED", reference: "EXP-VOID", category: "DOCUMENTATION", currency: "USD", amount: "50.000000" },
];

test("project expense view fails closed to the selected project and excludes inactive expenses", () => {
  assert.deepEqual(filterProjectExpenses(expenses, "project-1").map((expense) => expense.reference), ["EXP-001"]);
  assert.throws(() => filterProjectExpenses(expenses, ""), /Project ID is required/);
});

test("expense list links preserve exact project and locale filters", () => {
  assert.equal(buildExpenseListHref("project/one", "ar"), "/accounts/expenses?projectId=project%2Fone&locale=ar");
});

test("project-filtered expense register is bilingual and preserves transaction scope and project 360", () => {
  const page = readFileSync("src/ui/features/accounts/ProjectExpensesPage.tsx", "utf8");
  const route = readFileSync("src/app/accounts/expenses/page.tsx", "utf8");
  const money = readFileSync("src/app/projects/[id]/money/page.tsx", "utf8");
  assert.match(route, /BrowserFinanceRegisterPage/);
  assert.match(route, /kind="expenses"/);
  assert.match(route, /projectId/);
  assert.match(page, /ProjectContextNavigation/);
  assert.match(page, /Expenses/);
  assert.match(page, /المصروفات/);
  assert.match(page, /scopeType/);
  assert.match(page, /sales-shipments/);
  assert.match(page, /amount/);
  assert.match(money, /accounts\/expenses\?projectId=/);
});
