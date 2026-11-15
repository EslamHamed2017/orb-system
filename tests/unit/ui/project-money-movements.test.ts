import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildMoneyMovementListHref,
  filterProjectMoneyMovements,
  type MoneyMovementListItem,
} from "../../../src/ui/features/accounts/project-money-movements.ts";

const movements: readonly MoneyMovementListItem[] = [
  { id: "collection-2", projectId: "project-2", partyId: "customer-2", type: "COLLECTION", occurredOn: "2026-11-12", state: "POSTED", reference: "COL-002", currency: "AED", amount: "700.000000" },
  { id: "payment-1", projectId: "project-1", partyId: "supplier-1", type: "SUPPLIER_PAYMENT", occurredOn: "2026-11-11", state: "POSTED", reference: "PAY-001", currency: "USD", amount: "400.000000" },
  { id: "collection-1", projectId: "project-1", partyId: "customer-1", type: "COLLECTION", occurredOn: "2026-11-10", state: "POSTED", reference: "COL-001", currency: "USD", amount: "1000.000000" },
  { id: "collection-void", projectId: "project-1", partyId: "customer-1", type: "COLLECTION", occurredOn: "2026-11-13", state: "REVERSED", reference: "COL-VOID", currency: "USD", amount: "50.000000" },
];

test("money movement views fail closed by project and movement type while excluding inactive records", () => {
  assert.deepEqual(filterProjectMoneyMovements(movements, "project-1", "COLLECTION").map((item) => item.reference), ["COL-001"]);
  assert.deepEqual(filterProjectMoneyMovements(movements, "project-1", "SUPPLIER_PAYMENT").map((item) => item.reference), ["PAY-001"]);
  assert.throws(() => filterProjectMoneyMovements(movements, "", "COLLECTION"), /Project ID is required/);
});

test("collection and supplier payment links preserve exact project and locale filters", () => {
  assert.equal(buildMoneyMovementListHref("COLLECTION", "project/one", "ar"), "/accounts/collections?projectId=project%2Fone&locale=ar");
  assert.equal(buildMoneyMovementListHref("SUPPLIER_PAYMENT", "project/one", "en"), "/accounts/supplier-payments?projectId=project%2Fone&locale=en");
});

test("project money movement registers are bilingual, party-attributable, and connected to project 360", () => {
  const page = readFileSync("src/ui/features/accounts/ProjectMoneyMovementsPage.tsx", "utf8");
  const collectionsRoute = readFileSync("src/app/accounts/collections/page.tsx", "utf8");
  const paymentsRoute = readFileSync("src/app/accounts/supplier-payments/page.tsx", "utf8");
  const money = readFileSync("src/app/projects/[id]/money/page.tsx", "utf8");
  assert.match(collectionsRoute, /BrowserFinanceRegisterPage/);
  assert.match(collectionsRoute, /kind="collections"/);
  assert.match(paymentsRoute, /BrowserFinanceRegisterPage/);
  assert.match(paymentsRoute, /kind="supplierPayments"/);
  assert.match(page, /ProjectContextNavigation/);
  assert.match(page, /Collections/);
  assert.match(page, /التحصيلات/);
  assert.match(page, /Supplier payments/);
  assert.match(page, /دفعات الموردين/);
  assert.match(page, /partyId/);
  assert.match(page, /customers/);
  assert.match(page, /suppliers/);
  assert.match(money, /accounts\/collections\?projectId=/);
  assert.match(money, /accounts\/supplier-payments\?projectId=/);
});
