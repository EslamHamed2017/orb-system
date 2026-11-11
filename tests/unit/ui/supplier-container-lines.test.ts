import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateSupplierContainerSummary,
  validateSupplierContainerLines,
  type SupplierContainerLineDraft,
} from "../../../src/ui/features/shipments/supplier-container-lines.ts";

const lines: SupplierContainerLineDraft[] = [
  { id: "container-line-1", supplierId: "supplier-arbor", supplierName: "Arbor Export", purchaseContractId: "purchase-1", contractLineVersionId: "purchase-line-version-1", contractLineReference: "PUR-2026-011 · 1", productName: "Ethiopia Guji", quantity: "6000", remainingQuantity: "7000", unit: "kg", bagCount: 100, bagWeight: "60", netWeight: "6000", grossWeight: "6030", supplierLotReference: "ARB-GUJI-26" },
  { id: "container-line-2", supplierId: "supplier-blue-nile", supplierName: "Blue Nile Trading", purchaseContractId: "purchase-2", contractLineVersionId: "purchase-line-version-2", contractLineReference: "PUR-2026-019 · 1", productName: "Kenya AA", quantity: "2500.5", remainingQuantity: "3000", unit: "kg", bagCount: 50, bagWeight: "50.01", netWeight: "2500.5", grossWeight: "2520.5", supplierLotReference: "BNT-KAA-88" },
  { id: "container-line-3", supplierId: "supplier-arbor", supplierName: "Arbor Export", purchaseContractId: "purchase-3", contractLineVersionId: "purchase-line-version-3", contractLineReference: "PUR-2026-021 · 2", productName: "Colombia Supremo", quantity: "1000", remainingQuantity: "1200", unit: "kg", bagCount: 20, bagWeight: "50", netWeight: "1000", grossWeight: "1010", supplierLotReference: "ARB-COL-12" },
];

test("supplier container summary consolidates exact quantities while preserving supplier attribution", () => {
  assert.deepEqual(calculateSupplierContainerSummary(lines), {
    lineCount: 3, supplierCount: 2, totalQuantity: "9500.5", totalNetWeight: "9500.5", totalGrossWeight: "9560.5", totalBags: 170, unit: "kg",
    suppliers: [
      { supplierId: "supplier-arbor", supplierName: "Arbor Export", lineCount: 2, quantity: "7000", purchaseContractCount: 2 },
      { supplierId: "supplier-blue-nile", supplierName: "Blue Nile Trading", lineCount: 1, quantity: "2500.5", purchaseContractCount: 1 },
    ],
  });
});

test("supplier container lines require unique approved purchase lines and remaining capacity", () => {
  assert.deepEqual(validateSupplierContainerLines(lines), []);
  assert.deepEqual(validateSupplierContainerLines([]), ["LINES_REQUIRED"]);
  assert.deepEqual(validateSupplierContainerLines([
    { ...lines[0], quantity: "7000.000001", supplierLotReference: "" },
    { ...lines[1], contractLineVersionId: "purchase-line-version-1", bagCount: 0 },
  ]), [
    "QUANTITY_EXCEEDS_REMAINING:container-line-1",
    "SUPPLIER_LOT_REFERENCE_REQUIRED:container-line-1",
    "BAG_COUNT_MUST_BE_POSITIVE:container-line-2",
    "CONTRACT_LINE_VERSION_DUPLICATE:purchase-line-version-1",
  ]);
});

test("supplier shipment workspace composes bilingual multi-supplier container lines and draft form", () => {
  const core = readFileSync("src/ui/features/shipments/ShipmentWorkspaceCore.tsx", "utf8");
  const component = readFileSync("src/ui/features/shipments/SupplierContainerLines.tsx", "utf8");
  assert.match(core, /SupplierContainerLines/);
  assert.match(component, /Supplier container lines/);
  assert.match(component, /بنود حاوية الموردين/);
  assert.match(component, /Approved purchase-contract line/);
  assert.match(component, /بند عقد الشراء المعتمد/);
  assert.match(component, /Supplier attribution/);
  assert.match(component, /نسبة المورد/);
  assert.match(component, /data-operation-id="createSupplierShipmentLine"/);
  assert.match(component, /canMutate/);
});
