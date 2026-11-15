import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSalesInvoiceListHref,
  filterProjectSalesInvoices,
  type SalesInvoiceListItem,
} from "../../../src/ui/features/accounts/project-sales-invoices.ts";

const invoices: readonly SalesInvoiceListItem[] = [
  { id: "invoice-2", projectId: "project-2", shipmentId: "shipment-2", occurredOn: "2026-11-12", state: "ISSUED", reference: "SINV-002", currency: "AED", amount: "700.000000", outstandingAmount: "200.000000" },
  { id: "invoice-1", projectId: "project-1", shipmentId: "shipment-1", occurredOn: "2026-11-11", state: "PARTIALLY_PAID", reference: "SINV-001", currency: "USD", amount: "1000.000000", outstandingAmount: "400.000000" },
  { id: "invoice-3", projectId: "project-1", shipmentId: "shipment-3", occurredOn: "2026-11-13", state: "CANCELLED", reference: "SINV-VOID", currency: "USD", amount: "50.000000", outstandingAmount: "50.000000" },
];

test("project sales invoice view is fail-closed to the selected project and excludes cancelled invoices", () => {
  assert.deepEqual(filterProjectSalesInvoices(invoices, "project-1").map((invoice) => invoice.reference), ["SINV-001"]);
  assert.throws(() => filterProjectSalesInvoices(invoices, ""), /Project ID is required/);
});

test("sales invoice list links preserve project and locale filters", () => {
  assert.equal(buildSalesInvoiceListHref("project/one", "ar"), "/accounts/sales-invoices?projectId=project%2Fone&locale=ar");
});

test("project-filtered sales invoice page is bilingual and connected to project 360 navigation", () => {
  const page = readFileSync("src/ui/features/accounts/ProjectSalesInvoicesPage.tsx", "utf8");
  const route = readFileSync("src/app/accounts/sales-invoices/page.tsx", "utf8");
  assert.doesNotMatch(route, /BrowserFinanceRegisterPage|localStorage|PROJECT_STORAGE_KEY/);
  assert.match(route, /ProjectSalesInvoicesPage/);
  assert.match(route, /loadProjectSalesInvoices/);
  assert.match(route, /projectId/);
  assert.match(route, /DATABASE_URL/);
  assert.match(page, /no sample records are shown/);
  assert.match(page, /ProjectContextNavigation/);
  assert.match(page, /Sales invoices/);
  assert.match(page, /فواتير المبيعات/);
  assert.doesNotMatch(page, /const invoices|SINV-2026-014|sales-shipment-1/);
  assert.match(page, /shipmentReference/);
  assert.match(page, /projectReference/);
  assert.match(page, /sales-shipments/);
  assert.match(page, /outstandingAmount/);
});
