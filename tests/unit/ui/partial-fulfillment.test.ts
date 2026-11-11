import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPartialFulfillmentRows } from "../../../src/ui/features/shipments/partial-fulfillment.ts";

test("partial fulfillment rows preserve prior shipments and exact remaining quantities", () => {
  assert.deepEqual(buildPartialFulfillmentRows([
    { contractLineVersionId: "line-1", contractLineReference: "SAL-2026-004 · 1", productName: "Ethiopia Guji", contractedQuantity: "10000", availableBeforeShipment: "7000", currentShipmentQuantity: "6000", unit: "kg" },
    { contractLineVersionId: "line-2", contractLineReference: "SAL-2026-004 · 2", productName: "Kenya AA", contractedQuantity: "5000", availableBeforeShipment: "3000", currentShipmentQuantity: "2500", unit: "kg" },
  ]), [
    { contractLineVersionId: "line-1", contractLineReference: "SAL-2026-004 · 1", productName: "Ethiopia Guji", contractedQuantity: "10000", fulfilledBeforeShipment: "3000", currentShipmentQuantity: "6000", fulfilledQuantity: "9000", remainingQuantity: "1000", completionPercent: 90, unit: "kg" },
    { contractLineVersionId: "line-2", contractLineReference: "SAL-2026-004 · 2", productName: "Kenya AA", contractedQuantity: "5000", fulfilledBeforeShipment: "2000", currentShipmentQuantity: "2500", fulfilledQuantity: "4500", remainingQuantity: "500", completionPercent: 90, unit: "kg" },
  ]);
});

test("partial fulfillment rejects inconsistent or over-fulfilled quantities", () => {
  assert.throws(() => buildPartialFulfillmentRows([{ contractLineVersionId: "line-1", contractLineReference: "L1", productName: "Coffee", contractedQuantity: "10", availableBeforeShipment: "11", currentShipmentQuantity: "1", unit: "kg" }]), /AVAILABLE_EXCEEDS_CONTRACTED/);
  assert.throws(() => buildPartialFulfillmentRows([{ contractLineVersionId: "line-1", contractLineReference: "L1", productName: "Coffee", contractedQuantity: "10", availableBeforeShipment: "2", currentShipmentQuantity: "3", unit: "kg" }]), /CURRENT_EXCEEDS_AVAILABLE/);
});

test("sales shipment workspace exposes bilingual accessible line-level fulfillment visualization", () => {
  const core = readFileSync("src/ui/features/shipments/ShipmentWorkspaceCore.tsx", "utf8");
  const component = readFileSync("src/ui/features/shipments/PartialFulfillmentVisualization.tsx", "utf8");
  assert.match(core, /PartialFulfillmentVisualization/);
  assert.match(component, /Partial fulfillment/);
  assert.match(component, /التنفيذ الجزئي/);
  assert.match(component, /Remaining quantity/);
  assert.match(component, /الكمية المتبقية/);
  assert.match(component, /<progress/);
});
