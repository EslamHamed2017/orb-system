import assert from "node:assert/strict";
import test from "node:test";
import { createShipmentLineFulfillmentService, type ShipmentLineFulfillmentRepository } from "../../src/modules/shipments/shipment-line-fulfillment-service.ts";

const id = {
  sales: "019a5f9b-7c00-7000-8000-000000000301", supplier: "019a5f9b-7c00-7000-8000-000000000302",
  allocation: "019a5f9b-7c00-7000-8000-000000000303", project: "019a5f9b-7c00-7000-8000-000000000304",
  product: "019a5f9b-7c00-7000-8000-000000000305", version: "019a5f9b-7c00-7000-8000-000000000306",
};
function repository(): ShipmentLineFulfillmentRepository & { allocations: any[]; serializableCalls: number } {
  const subject = {
    allocations: [] as any[], serializableCalls: 0,
    async runSerializable<T>(input: { salesShipmentDatasetLineId: string; supplierShipmentDatasetLineId: string }, work: (locked: any) => Promise<T>) {
      assert.deepEqual(input, { salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier });
      subject.serializableCalls++;
      return work({
        salesLine: { id: id.sales, projectId: id.project, coffeeSpecificationId: id.product, quantity: "60.000000", allocatedQuantity: subject.allocations.reduce((n, x) => n + Number(x.quantity), 0).toFixed(6) },
        supplierLine: { id: id.supplier, projectId: id.project, coffeeSpecificationId: id.product, quantity: "100.000000", allocatedQuantity: subject.allocations.reduce((n, x) => n + Number(x.quantity), 0).toFixed(6) },
        insert: async (row: any) => { subject.allocations.push(row); return row; },
      });
    },
    async getContractLineFulfillment(versionId: string) {
      return versionId === id.version ? { contractLineVersionId: id.version, approvedQuantity: "100.000000", unitPrice: "12.345678", fulfilledQuantity: "35.500000" } : null;
    },
  };
  return subject;
}

test("source allocation locks both lines in a serializable transaction and supports partial fulfillment", async () => {
  const repo = repository();
  const service = createShipmentLineFulfillmentService({ repository: repo, newId: () => id.allocation });
  const created = await service.allocate({ salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "35.500000", correlationId: "partial" });
  assert.deepEqual(created, { id: id.allocation, salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "35.500000" });
  assert.equal(repo.serializableCalls, 1);
  await assert.rejects(() => service.allocate({ salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "25.000001", correlationId: "over-sales" }), (error: any) => error.problem?.code === "FULFILLMENT_QUANTITY_EXCEEDED");
});

test("allocation rejects non-positive, cross-project and mismatched-product sources", async () => {
  const repo = repository(); const service = createShipmentLineFulfillmentService({ repository: repo });
  await assert.rejects(() => service.allocate({ salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "0", correlationId: "zero" }), (error: any) => error.problem?.code === "VALIDATION_FAILED");
  await assert.rejects(() => service.allocate({ salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "100000000000000.000000", correlationId: "decimal-overflow" }), (error: any) => error.problem?.code === "VALIDATION_FAILED");
  for (const override of [{ projectId: "019a5f9b-7c00-7000-8000-000000000399" }, { coffeeSpecificationId: "019a5f9b-7c00-7000-8000-000000000398" }]) {
    repo.runSerializable = async (_input: any, work: any) => work({ salesLine: { id: id.sales, projectId: id.project, coffeeSpecificationId: id.product, quantity: "60", allocatedQuantity: "0" }, supplierLine: { id: id.supplier, projectId: override.projectId ?? id.project, coffeeSpecificationId: override.coffeeSpecificationId ?? id.product, quantity: "100", allocatedQuantity: "0" }, insert: async (row: any) => row });
    await assert.rejects(() => service.allocate({ salesShipmentDatasetLineId: id.sales, supplierShipmentDatasetLineId: id.supplier, quantity: "1.000000", correlationId: "mismatch" }), (error: any) => error.problem?.code === "ALLOCATION_SOURCE_MISMATCH");
  }
});

test("remaining quantity and value use exact fixed-point decimal arithmetic", async () => {
  const service = createShipmentLineFulfillmentService({ repository: repository() });
  assert.deepEqual(await service.remaining({ contractLineVersionId: id.version, correlationId: "remaining" }), {
    contractLineVersionId: id.version, approvedQuantity: "100.000000", fulfilledQuantity: "35.500000", remainingQuantity: "64.500000", unitPrice: "12.345678", remainingValue: "796.296231000000",
  });
});


test("fulfillment routes enforce write and read roles before invoking dependencies", async () => {
  const allocationRoute = await import("../../src/app/api/sales-shipment-lines/[lineId]/source-allocations/route.ts");
  let called = false;
  const denied = await allocationRoute.createPostHandler({ authenticate: async () => ({ userId: id.sales, roles: ["FINANCE_VIEWER"] }), allocate: async () => { called = true; return {}; } })(new Request("https://orb.example/api/sales-shipment-lines/x/source-allocations", { method: "POST", body: "{}" }), { params: Promise.resolve({ lineId: id.sales }) });
  assert.equal(denied.status, 403); assert.equal(called, false);
  const remainingRoute = await import("../../src/app/api/contract-line-versions/[versionId]/fulfillment/route.ts");
  const allowed = await remainingRoute.createGetHandler({ authenticate: async () => ({ userId: id.sales, roles: ["FINANCE_VIEWER"] }), remaining: async ({ versionId }) => { called = true; return { versionId }; } })(new Request("https://orb.example/api/contract-line-versions/x/fulfillment"), { params: Promise.resolve({ versionId: id.version }) });
  assert.equal(allowed.status, 200); assert.equal(called, true); assert.deepEqual(await allowed.json(), { versionId: id.version });
});
