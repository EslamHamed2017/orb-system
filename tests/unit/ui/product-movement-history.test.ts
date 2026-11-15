import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterProductMovements,
  summarizeProductMovements,
  type ProductMovementHistoryRecord,
} from "../../../src/ui/features/masters/product-movement-history.ts";

const movements: readonly ProductMovementHistoryRecord[] = [
  { id: "movement-1", occurredAt: "2026-11-03T08:00:00.000Z", direction: "INBOUND", projectId: "project-orion", projectReference: "PRJ-2026-014", projectName: "Orion Coffee", quantity: "6000.000000", unit: "kg", transactionType: "SUPPLIER_CONTAINER", transactionId: "container-1", transactionReference: "SCN-2026-0081", counterpartyName: "Arbor Export", contractLineReference: "PUR-2026-011 · 1", sourceAllocationCount: 0 },
  { id: "movement-2", occurredAt: "2026-11-08T10:30:00.000Z", direction: "OUTBOUND", projectId: "project-orion", projectReference: "PRJ-2026-014", projectName: "Orion Coffee", quantity: "1250.500000", unit: "kg", transactionType: "SALES_SHIPMENT", transactionId: "shipment-1", transactionReference: "SSH-2026-0042", counterpartyName: "Northstar Roasters", contractLineReference: "SAL-2026-004 · 1", sourceAllocationCount: 2 },
  { id: "movement-3", occurredAt: "2026-11-09T12:00:00.000Z", direction: "OUTBOUND", projectId: "project-atlas", projectReference: "PRJ-2026-019", projectName: "Atlas Trading", quantity: "749.500000", unit: "kg", transactionType: "SALES_SHIPMENT", transactionId: "shipment-2", transactionReference: "SSH-2026-0045", counterpartyName: "Atlas Retail", contractLineReference: "SAL-2026-009 · 2", sourceAllocationCount: 1 },
];

test("product movement history summarizes exact inbound and outbound traceability without a stock balance", () => {
  assert.deepEqual(summarizeProductMovements(movements), { movementCount: 3, projectCount: 2, inboundQuantity: "6000", outboundQuantity: "2000", unit: "kg" });
});

test("product movement history filters by project, direction and transaction search", () => {
  assert.deepEqual(filterProductMovements(movements, { projectId: "project-orion", direction: "OUTBOUND", query: "northstar" }).map((item) => item.id), ["movement-2"]);
  assert.deepEqual(filterProductMovements(movements, { direction: "ALL", query: "SCN-2026-0081" }).map((item) => item.id), ["movement-1"]);
});

test("product movement page is bilingual, links source transactions and states its non-inventory scope", () => {
  const component = readFileSync("src/ui/features/masters/ProductMovementHistoryPage.tsx", "utf8");
  const route = readFileSync("src/app/products/[productId]/movements/page.tsx", "utf8");
  assert.match(route, /ProductMovementHistoryPage/);
  assert.match(component, /Product movement/);
  assert.match(component, /حركة المنتج/);
  assert.match(component, /not a stock balance or inventory valuation/);
  assert.match(component, /ليست رصيد مخزون أو تقييم مخزون/);
  assert.match(component, /SALES_SHIPMENT/);
  assert.match(component, /SUPPLIER_CONTAINER/);
  assert.match(component, /sourceAllocationCount/);
});


test("browser-only product records do not link to unrelated fixed movement history", () => {
  const products = readFileSync("src/ui/features/masters/ProductsMasterPage.tsx", "utf8");
  const movementPage = readFileSync("src/ui/features/masters/ProductMovementHistoryPage.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.doesNotMatch(products, /products\/\$\{product.id\}\/movements/);
  assert.match(movementPage, /const MOVEMENTS:/);
  assert.match(navigation, /pathname.startsWith\("\/products\/"\)/);
});
