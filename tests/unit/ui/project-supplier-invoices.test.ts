import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupplierInvoiceListHref,
  filterProjectSupplierInvoices,
  type SupplierInvoiceListItem,
} from "../../../src/ui/features/accounts/project-supplier-invoices.ts";

const invoices: readonly SupplierInvoiceListItem[] = [
  { id: "invoice-2", projectId: "project-2", supplierId: "supplier-2", containerId: "container-2", occurredOn: "2026-11-12", state: "CONFIRMED", reference: "PINV-002", currency: "AED", amount: "700.000000", outstandingAmount: "200.000000" },
  { id: "invoice-1", projectId: "project-1", supplierId: "supplier-1", containerId: "container-1", occurredOn: "2026-11-11", state: "CONFIRMED", reference: "PINV-001", currency: "USD", amount: "1000.000000", outstandingAmount: "400.000000" },
  { id: "invoice-3", projectId: "project-1", supplierId: "supplier-2", containerId: "container-1", occurredOn: "2026-11-13", state: "CANCELLED", reference: "PINV-VOID", currency: "USD", amount: "50.000000", outstandingAmount: "0.000000" },
];

test("project supplier invoice view is fail-closed to the selected project and excludes cancelled invoices", () => {
  assert.deepEqual(filterProjectSupplierInvoices(invoices, "project-1").map((invoice) => invoice.reference), ["PINV-001"]);
  assert.throws(() => filterProjectSupplierInvoices(invoices, ""), /Project ID is required/);
});

test("supplier invoice list links preserve project and locale filters", () => {
  assert.equal(buildSupplierInvoiceListHref("project/one", "ar"), "/accounts/supplier-invoices?projectId=project%2Fone&locale=ar");
});

test("project-filtered supplier invoice page preserves supplier attribution and 360 navigation", () => {
  const page = readFileSync("src/ui/features/accounts/ProjectSupplierInvoicesPage.tsx", "utf8");
  const route = readFileSync("src/app/accounts/supplier-invoices/page.tsx", "utf8");
  const money = readFileSync("src/app/projects/[id]/money/page.tsx", "utf8");
  assert.match(route, /ProjectSupplierInvoicesPage/);
  assert.match(route, /canUpload/);
  assert.match(route, /projectId/);
  assert.match(page, /ProjectContextNavigation/);
  assert.match(page, /Supplier invoices/);
  assert.match(page, /فواتير الموردين/);
  assert.match(page, /supplierId/);
  assert.match(page, /supplier-shipments/);
  assert.match(page, /outstandingAmount/);
  assert.match(money, /accounts\/supplier-invoices\?projectId=/);
});
