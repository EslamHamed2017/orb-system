import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildProductMovementReport,
  type ProductMovementReportRecord,
} from "../../../src/ui/features/reports/product-movement-report.ts";

const rows: readonly ProductMovementReportRecord[] = [
  { id: "m-1", occurredOn: "2026-11-03", direction: "INBOUND", productId: "p-1", productReference: "PROD-001", productName: "Ethiopia Yirgacheffe", projectId: "project-orion", projectReference: "PRJ-014", quantity: "6000.000000", unit: "kg", transactionType: "SUPPLIER_CONTAINER", transactionId: "container-81", transactionReference: "SCN-0081", counterpartyName: "Arbor Export", contractLineReference: "PUR-011 · 1" },
  { id: "m-2", occurredOn: "2026-11-08", direction: "OUTBOUND", productId: "p-1", productReference: "PROD-001", productName: "Ethiopia Yirgacheffe", projectId: "project-orion", projectReference: "PRJ-014", quantity: "1250.500000", unit: "kg", transactionType: "SALES_SHIPMENT", transactionId: "shipment-42", transactionReference: "SSH-0042", counterpartyName: "Northstar Roasters", contractLineReference: "SAL-004 · 1" },
  { id: "m-3", occurredOn: "2026-11-09", direction: "OUTBOUND", productId: "p-2", productReference: "PROD-002", productName: "Brazil Santos", projectId: "project-atlas", projectReference: "PRJ-019", quantity: "10.250000", unit: "bag", transactionType: "SALES_SHIPMENT", transactionId: "shipment-45", transactionReference: "SSH-0045", counterpartyName: "Atlas Retail", contractLineReference: "SAL-009 · 2" },
];

test("product movement report filters cross-product traceability and keeps exact totals partitioned by unit", () => {
  const report = buildProductMovementReport(rows, { projectId: "project-orion", productId: "p-1", direction: "ALL", from: "2026-11-01", to: "2026-11-30", query: "" });
  assert.deepEqual(report.items.map((row) => row.id), ["m-1", "m-2"]);
  assert.deepEqual(report.summary, { movementCount: 2, productCount: 1, projectCount: 1, totals: [{ unit: "kg", inboundQuantity: "6000", outboundQuantity: "1250.5" }] });
  assert.equal(Object.hasOwn(report.summary, "stockOnHand"), false);
  assert.equal(Object.hasOwn(report.summary, "inventoryValue"), false);
});

test("product movement report validates date ranges and supports direction and source search", () => {
  assert.deepEqual(buildProductMovementReport(rows, { direction: "OUTBOUND", from: "2026-11-09", query: "atlas" }).items.map((row) => row.id), ["m-3"]);
  assert.throws(() => buildProductMovementReport(rows, { direction: "ALL", from: "2026-11-30", to: "2026-11-01", query: "" }), /INVERTED_MOVEMENT_DATE_RANGE/);
  assert.throws(() => buildProductMovementReport(rows, { direction: "ALL", from: "11\/01\/2026", query: "" }), /INVALID_MOVEMENT_DATE/);
});

test("dedicated product movement report is bilingual, filterable, and links products and source transactions", () => {
  const page = readFileSync("src/ui/features/reports/ProductMovementReportPage.tsx", "utf8");
  const route = readFileSync("src/app/reports/product-movement/page.tsx", "utf8");
  assert.match(route, /ProductMovementReportPage/);
  assert.match(page, /Product movement report/);
  assert.match(page, /تقرير حركة المنتج/);
  assert.match(page, /not a stock balance or inventory valuation/);
  assert.match(page, /ليس رصيد مخزون أو تقييم مخزون/);
  assert.match(page, /reports-product-movement-title/);
  assert.match(page, /\/products\/\$\{movement.productId\}\/movements/);
  assert.match(page, /SALES_SHIPMENT/);
  assert.match(page, /supplier-shipments/);
});

test("reports hub routes product movement filters to the dedicated report", () => {
  const hub = readFileSync("src/ui/features/reports/reports-hub.ts", "utf8");
  assert.match(hub, /\/reports\/product-movement/);
});


test("movement UI has no fixed demo movement rows", () => { const source = readFileSync("src/ui/features/reports/ProductMovementReportPage.tsx", "utf8"); assert.match(source, /Object\.freeze\(\[\]\)/); for (const fixture of ["movement-1", "project-orion", "Arbor Export", "Northstar Roasters"]) assert.equal(source.includes(fixture), false); });
