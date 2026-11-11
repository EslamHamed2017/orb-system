import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductMovementService,
  type ProductMovementRepository,
} from "../../../src/modules/masters/product-movement-service.ts";

const id = {
  product: "019a5f9b-7c00-7000-8000-000000000501",
  otherProduct: "019a5f9b-7c00-7000-8000-000000000502",
  projectA: "019a5f9b-7c00-7000-8000-000000000503",
  projectB: "019a5f9b-7c00-7000-8000-000000000504",
  supplierLine: "019a5f9b-7c00-7000-8000-000000000505",
  salesLineA: "019a5f9b-7c00-7000-8000-000000000506",
  salesLineB: "019a5f9b-7c00-7000-8000-000000000507",
};

const repository: ProductMovementRepository = {
  async productExists(productId) { return productId === id.product; },
  async listByProduct() {
    return [
      { id: id.salesLineB, occurredAt: "2026-11-11T12:00:00.000Z", direction: "OUTBOUND", projectId: id.projectB, productId: id.product, quantity: "5", transactionType: "SALES_SHIPMENT", transactionId: "019a5f9b-7c00-7000-8000-000000000510", shipmentLineId: id.salesLineB, contractLineVersionId: "019a5f9b-7c00-7000-8000-000000000511", counterpartyId: "019a5f9b-7c00-7000-8000-000000000512", sourceAllocations: [] },
      { id: id.supplierLine, occurredAt: "2026-11-11T10:00:00.000Z", direction: "INBOUND", projectId: id.projectA, productId: id.product, quantity: "12.500000", transactionType: "SUPPLIER_CONTAINER", transactionId: "019a5f9b-7c00-7000-8000-000000000513", shipmentLineId: id.supplierLine, contractLineVersionId: "019a5f9b-7c00-7000-8000-000000000514", counterpartyId: "019a5f9b-7c00-7000-8000-000000000515", sourceAllocations: [] },
      { id: id.salesLineA, occurredAt: "2026-11-11T11:00:00.000Z", direction: "OUTBOUND", projectId: id.projectA, productId: id.product, quantity: "7.5", transactionType: "SALES_SHIPMENT", transactionId: "019a5f9b-7c00-7000-8000-000000000516", shipmentLineId: id.salesLineA, contractLineVersionId: "019a5f9b-7c00-7000-8000-000000000517", counterpartyId: "019a5f9b-7c00-7000-8000-000000000518", sourceAllocations: [{ supplierShipmentLineId: id.supplierLine, quantity: "7.5" }] },
      { id: "019a5f9b-7c00-7000-8000-000000000519", occurredAt: "2026-11-11T09:00:00.000Z", direction: "INBOUND", projectId: id.projectA, productId: id.otherProduct, quantity: "99", transactionType: "SUPPLIER_CONTAINER", transactionId: "019a5f9b-7c00-7000-8000-000000000520", shipmentLineId: "019a5f9b-7c00-7000-8000-000000000519", contractLineVersionId: "019a5f9b-7c00-7000-8000-000000000521", counterpartyId: "019a5f9b-7c00-7000-8000-000000000522", sourceAllocations: [] },
    ];
  },
};

test("product movement query returns chronological cross-project traceability without inventory balances", async () => {
  const service = createProductMovementService({ repository });
  const result = await service.list({ productId: id.product, correlationId: "movement-all", principal: { userId: "operations", roles: ["OPERATIONS"] } });
  assert.equal(result.productId, id.product);
  assert.deepEqual(result.items.map((row) => [row.direction, row.projectId, row.quantity]), [
    ["INBOUND", id.projectA, "12.500000"],
    ["OUTBOUND", id.projectA, "7.500000"],
    ["OUTBOUND", id.projectB, "5.000000"],
  ]);
  assert.deepEqual(result.items[1].sourceAllocations, [{ supplierShipmentLineId: id.supplierLine, quantity: "7.500000" }]);
  assert.equal("stockOnHand" in result, false);
  assert.equal("inventoryValue" in result, false);

  const project = await service.list({ productId: id.product, projectId: id.projectA, correlationId: "movement-project", principal: { userId: "operations", roles: ["OPERATIONS"] } });
  assert.deepEqual(project.items.map((row) => row.projectId), [id.projectA, id.projectA]);
});
