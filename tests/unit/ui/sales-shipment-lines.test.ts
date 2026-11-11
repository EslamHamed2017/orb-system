import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateSalesShipmentSummary,
  validateSalesShipmentLines,
  type SalesShipmentLineDraft,
} from "../../../src/ui/features/shipments/sales-shipment-lines.ts";

const lines: SalesShipmentLineDraft[] = [
  { id: "shipment-line-1", contractLineVersionId: "contract-version-1", contractLineReference: "SAL-2026-004 · 1", productName: "Ethiopia Guji", quantity: "6000", remainingQuantity: "7000", unit: "kg", bagCount: 100, bagWeight: "60", netWeight: "6000", grossWeight: "6030", customerPurchaseOrderReference: "PO-481", marksAndNumbers: "ORB-GUJI" },
  { id: "shipment-line-2", contractLineVersionId: "contract-version-2", contractLineReference: "SAL-2026-004 · 2", productName: "Kenya AA", quantity: "2500.5", remainingQuantity: "3000", unit: "kg", bagCount: 50, bagWeight: "50.01", netWeight: "2500.5", grossWeight: "2520.5", customerPurchaseOrderReference: null, marksAndNumbers: null },
];

test("multi-line sales shipment summary uses exact decimal arithmetic", () => {
  assert.deepEqual(calculateSalesShipmentSummary(lines), {
    lineCount: 2, totalQuantity: "8500.5", totalNetWeight: "8500.5", totalGrossWeight: "8550.5", totalBags: 150, unit: "kg",
  });
});

test("sales shipment lines require unique approved contract lines and stay within remaining quantity", () => {
  assert.deepEqual(validateSalesShipmentLines(lines), []);
  assert.deepEqual(validateSalesShipmentLines([]), ["LINES_REQUIRED"]);
  assert.deepEqual(validateSalesShipmentLines([
    { ...lines[0], quantity: "7000.000001" },
    { ...lines[1], contractLineVersionId: "contract-version-1", bagCount: 0 },
  ]), [
    "QUANTITY_EXCEEDS_REMAINING:shipment-line-1",
    "BAG_COUNT_MUST_BE_POSITIVE:shipment-line-2",
    "CONTRACT_LINE_VERSION_DUPLICATE:contract-version-1",
  ]);
});

test("sales shipment workspace composes bilingual contract-bound line detail and form", () => {
  const core = readFileSync("src/ui/features/shipments/ShipmentWorkspaceCore.tsx", "utf8");
  const component = readFileSync("src/ui/features/shipments/SalesShipmentLines.tsx", "utf8");
  assert.match(core, /SalesShipmentLines/);
  assert.match(component, /Shipment lines/);
  assert.match(component, /بنود الشحنة/);
  assert.match(component, /Approved contract line/);
  assert.match(component, /بند العقد المعتمد/);
  assert.match(component, /Remaining after shipment/);
  assert.match(component, /المتبقي بعد الشحنة/);
  assert.match(component, /data-operation-id="createSalesShipmentLine"/);
  assert.match(component, /canMutate/);
});
