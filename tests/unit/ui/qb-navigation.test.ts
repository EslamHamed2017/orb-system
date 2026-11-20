import assert from "node:assert/strict";
import test from "node:test";
import { GEAR, NEW_IN_PROJECT, NEW_MENU, SECTIONS, sectionFor, sectionHref } from "../../../src/ui/navigation/qb-navigation.ts";
import { navigationAccessForRole, type NavigationDestination } from "../../../src/ui/navigation/permission-aware-access.ts";

const can = (role: string) => (d: NavigationDestination) => navigationAccessForRole(role, d);

test("the side menu is QuickBooks' five: Home, Sales, Expenses, Projects, Reports", () => {
  assert.deepEqual(SECTIONS.map((s) => s.en), ["Home", "Sales", "Expenses", "Projects", "Reports"]);
  assert.deepEqual(SECTIONS.map((s) => s.ar), ["الرئيسية", "المبيعات", "المصروفات", "المشاريع", "التقارير"]);
});

test("pages land in their section with the right tab", () => {
  assert.deepEqual([sectionFor("/accounts/collections")?.section.key, sectionFor("/accounts/collections")?.page?.key], ["sales", "collections"]);
  assert.deepEqual([sectionFor("/masters/suppliers")?.section.key, sectionFor("/masters/suppliers")?.page?.key], ["expenses", "suppliers"]);
  assert.equal(sectionFor("/customers/abc")?.page?.key, "customers");
  assert.equal(sectionFor("/projects/x/money")?.section.key, "projects");
  assert.equal(sectionFor("/sales-shipments/x")?.section.key, "projects");
  assert.equal(sectionFor("/reports/accounts")?.section.key, "reports");
  assert.equal(sectionFor("/")?.section.key, "home");
});

test("each role opens the first page of a section it may see", () => {
  const sales = SECTIONS.find((s) => s.key === "sales")!, expenses = SECTIONS.find((s) => s.key === "expenses")!;
  assert.equal(sectionHref(sales, can("FINANCE_VIEWER")), "/accounts/sales-invoices");
  assert.equal(sectionHref(sales, can("OPERATIONS")), "/masters/customers");
  assert.equal(sectionHref(expenses, can("OPERATIONS")), "/masters/suppliers");
  assert.equal(sectionHref(SECTIONS.find((s) => s.key === "reports")!, can("OPERATIONS")), null);
});

test("+ New has QuickBooks' four columns and every project-bound item knows where to go", () => {
  assert.deepEqual(NEW_MENU.map((c) => c.en), ["Customers", "Suppliers", "Projects", "Other"]);
  for (const item of NEW_MENU.flatMap((c) => c.items)) if (item.href.startsWith("/new/")) assert.ok(NEW_IN_PROJECT[item.href.slice(5)], item.key);
  assert.deepEqual(GEAR.map((g) => g.en), ["Your company", "Lists", "Tools"]);
});
