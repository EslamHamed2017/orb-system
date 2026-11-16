import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSalesInvoiceListHref,
  filterProjectSalesInvoices,
  localizeInvoiceState,
  type SalesInvoiceListItem,
} from "../../../src/ui/features/accounts/project-sales-invoices.ts";

const invoices: readonly SalesInvoiceListItem[] = [
  { id: "invoice-2", projectId: "project-2", shipmentId: "shipment-2", occurredOn: "2026-11-12", state: "ISSUED", reference: "SINV-002", currency: "AED", amount: "700.000000", outstandingAmount: "200.000000" },
  { id: "invoice-1", projectId: "project-1", shipmentId: "shipment-1", occurredOn: "2026-11-11", state: "PENDING_APPROVAL", reference: "SINV-001", currency: "USD", amount: "1000.000000", outstandingAmount: "400.000000" },
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
  assert.match(route, /ProjectSalesInvoicesPage/);
  assert.match(route, /canUpload/);
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


test("global sales invoice route loads persisted records without requiring a project filter", () => {
  const route = readFileSync("src/app/accounts/sales-invoices/page.tsx", "utf8");
  const loader = readFileSync("src/modules/invoices/load-project-sales-invoices.ts", "utf8");
  assert.doesNotMatch(route, /if \(!projectId \|\| !databaseAvailable\)/);
  assert.match(route, /loadProjectSalesInvoices\(projectId\)/);
  assert.match(loader, /projectId\?: string/);
  assert.match(loader, /\$1::text IS NULL OR i\.project_id::text = \$1/);
});

test("persisted invoice lines expose a source-derived unit and allocations match invoice currency, project, and customer", () => {
  const loader = readFileSync("src/modules/invoices/load-project-sales-invoices.ts", "utf8");
  assert.doesNotMatch(loader, /'unit', ''/);
  assert.match(loader, /'unit', CASE/);
  assert.match(loader, /JOIN "MoneyMovement" movement/);
  assert.match(loader, /allocation\.currency = i\.currency/);
  assert.match(loader, /movement\.project_id = i\.project_id/);
  assert.match(loader, /movement\.party_id = i\.customer_id/);
  assert.doesNotMatch(loader, /movement\.state/);
});

test("persisted sales invoice register uses the database allocation contract and loads traced lines", () => {
  const loader = readFileSync("src/modules/invoices/load-project-sales-invoices.ts", "utf8");
  assert.match(loader, /target_type::text = 'CINV'/);
  assert.doesNotMatch(loader, /target_type::text = 'SALES_INVOICE'/);
  assert.match(loader, /SalesShipmentDatasetLine/);
  assert.match(loader, /source_reference/);
  assert.match(loader, /lines:/);
  const fixture = readFileSync("tests/fixtures/r1-project-cycle.ts", "utf8");
  const seed = readFileSync("prisma/seed.ts", "utf8");
  assert.match(fixture, /R1_SALES_DATASET_LINES/);
  assert.match(fixture, /R1_SALES_INVOICE_LINES/);
  assert.match(seed, /salesShipmentDatasetLine/);
  assert.match(seed, /salesInvoiceLine/);
});

test("sales invoice lifecycle labels remain truthful in both locales", () => {
  const page = readFileSync("src/ui/features/accounts/ProjectSalesInvoicesPage.tsx", "utf8");
  const model = readFileSync("src/ui/features/accounts/project-sales-invoices.ts", "utf8");
  const print = readFileSync("src/ui/features/accounts/InvoicePrintDocument.tsx", "utf8");
  assert.match(model, /PENDING_APPROVAL/);
  assert.match(model, /Pending approval/);
  assert.match(model, /بانتظار الموافقة/);
  assert.doesNotMatch(page, /Partially paid|مدفوعة جزئياً/);
  assert.match(print, /localizeInvoiceState/);
  assert.equal(localizeInvoiceState("PENDING_APPROVAL", "en"), "Pending approval");
  assert.equal(localizeInvoiceState("PENDING_APPROVAL", "ar"), "بانتظار الموافقة");
  assert.equal(localizeInvoiceState("ISSUED", "en"), "Issued");
  assert.equal(localizeInvoiceState("ISSUED", "ar"), "صادرة");
});

test("mobile invoice register exposes an explicit horizontal scroll region", () => {
  const styles = readFileSync("src/ui/features/accounts/AccountsHubPage.module.css", "utf8");
  const page = readFileSync("src/ui/features/accounts/ProjectSalesInvoicesPage.tsx", "utf8");
  assert.match(styles, /\.tableWrap\{[^}]*overflow-x:auto/);
  assert.match(styles, /\.table\{[^}]*min-inline-size:/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /aria-label=\{ar \? "تمرير جدول فواتير المبيعات" : "Scroll sales invoice register"\}/);
});
