import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAccountDestinations,
  selectRecentAccountRecords,
  accountRecordHref,
  type AccountHubRecord,
} from "../../../src/ui/features/accounts/accounts-hub.ts";

const records: readonly AccountHubRecord[] = [
  { id: "expense-1", projectId: "project-2", type: "EXPENSE", occurredOn: "2026-11-10", state: "POSTED", reference: "EXP-002", currency: "AED", amount: "120.000000", outstandingAmount: "0.000000" },
  { id: "invoice-1", projectId: "project-1", type: "SALES_INVOICE", occurredOn: "2026-11-11", state: "ISSUED", reference: "SINV-001", currency: "USD", amount: "1000.000000", outstandingAmount: "400.000000" },
  { id: "cancelled-1", projectId: "project-1", type: "SUPPLIER_PAYMENT", occurredOn: "2026-11-12", state: "CANCELLED", reference: "PAY-VOID", currency: "USD", amount: "20.000000", outstandingAmount: "0.000000" },
];

test("global Accounts hub keeps operational records currency-partitioned and excludes inactive movements", () => {
  assert.deepEqual(selectRecentAccountRecords(records, 2).map((record) => record.reference), ["SINV-001", "EXP-002"]);
});

test("global Accounts hub exposes every approved account destination in both locales", () => {
  assert.deepEqual(buildAccountDestinations("en").map(({ key, href }) => [key, href]), [
    ["salesInvoices", "/accounts/sales-invoices?locale=en"],
    ["supplierInvoices", "/accounts/supplier-invoices?locale=en"],
    ["collections", "/accounts/collections?locale=en"],
    ["supplierPayments", "/accounts/supplier-payments?locale=en"],
    ["expenses", "/accounts/expenses?locale=en"],
  ]);
  assert.deepEqual(buildAccountDestinations("ar").map(({ label }) => label), ["فواتير المبيعات", "فواتير الموردين", "التحصيلات", "دفعات الموردين", "المصروفات"]);
});

test("Accounts hub is an independent bilingual primary destination with direct section navigation", () => {
  const page = readFileSync("src/ui/features/accounts/AccountsHubPage.tsx", "utf8");
  const route = readFileSync("src/app/accounts/page.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.match(route, /AccountsHubPage/);
  assert.match(page, /Accounts hub/);
  assert.match(page, /مركز الحسابات/);
  assert.match(page, /Operational accounts/);
  assert.match(page, /الحسابات التشغيلية/);
  assert.doesNotMatch(page, /185,000|SINV-2026-014|Independent totals/);
  assert.match(navigation, /href={`\/accounts\$\{suffix}`}/);
  assert.match(navigation, /label={label\("Accounts", "الحسابات"\)}/);
});

test("Accounts hub renders supplied persisted activity and contains no fixed transaction fixture", () => {
  const page = readFileSync("src/ui/features/accounts/AccountsHubPage.tsx", "utf8");
  const route = readFileSync("src/app/accounts/page.tsx", "utf8");
  assert.doesNotMatch(page, /const recentRecords\s*=\s*\[|PINV-2026-044|PAY-2026-044|COL-2026-014/);
  assert.match(page, /records: readonly AccountHubRecord\[\]/);
  assert.match(page, /selectRecentAccountRecords\(records/);
  assert.match(route, /loadProjectSalesInvoices/);
  assert.match(route, /records=/);
});

test("Accounts hub exposes only persisted destinations and wraps them as responsive cards", () => {
  const page = readFileSync("src/ui/features/accounts/AccountsHubPage.tsx", "utf8");
  const styles = readFileSync("src/ui/features/accounts/AccountsHubPage.module.css", "utf8");
  assert.match(page, /filter\(\(destination\) => destination\.key === "salesInvoices"\)/);
  assert.match(page, /className=\{styles\.destinationGrid\}/);
  assert.match(page, /className=\{styles\.destinationCard\}/);
  assert.match(styles, /\.page>\*\{min-inline-size:0\}/);
  assert.match(styles, /\.destinationGrid\{/);
  assert.match(styles, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,14rem\),1fr\)\)/);
  assert.match(page, /const activeRecords = selectRecentAccountRecords\(records, records\.length\)/);
  assert.match(page, /new Set\(activeRecords\.map/);
  assert.match(page, /Recent persisted sales invoices/);
  assert.match(page, /آخر فواتير المبيعات المحفوظة/);
});

test("account activity links resolve to canonical typed list routes", () => {
  assert.equal(accountRecordHref("SALES_INVOICE", "en"), "/accounts/sales-invoices?locale=en");
  assert.equal(accountRecordHref("SUPPLIER_PAYMENT", "ar"), "/accounts/supplier-payments?locale=ar");
});
