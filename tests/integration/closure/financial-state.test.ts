import assert from "node:assert/strict";
import test from "node:test";

const PROJECT_ID = "019a6000-0000-7000-8000-000000000001";
const ACTIVE_SHIPMENT = "019a6000-0000-7000-8000-000000000002";
const CANCELLED_SHIPMENT = "019a6000-0000-7000-8000-000000000003";

type FinancialState = {
  projectId: string;
  state: "OPEN" | "FINANCIALLY_CLOSED";
  shipments: readonly { shipmentId: string; state: "OPEN" | "FINANCIALLY_CLOSED"; approvedCinvCount: number; customerOutstanding: string }[];
};
interface ClosureService { financialState(projectId: string): Promise<FinancialState> }
interface ClosureModule { createInMemoryClosureService(options: Record<string, unknown>): ClosureService }

async function subject(overrides: Record<string, unknown> = {}): Promise<ClosureService> {
  const modulePath = "../../../src/modules/closure/closure-service.ts";
  const module = await import(modulePath) as ClosureModule;
  return module.createInMemoryClosureService({
    projects: [{ id: PROJECT_ID, version: 20, state: "ACTIVE" }],
    salesShipments: [
      { id: ACTIVE_SHIPMENT, projectId: PROJECT_ID, executionState: "DELIVERED" },
      { id: CANCELLED_SHIPMENT, projectId: PROJECT_ID, executionState: "CANCELLED" },
    ],
    documents: [{ id: "cinv-active", projectId: PROJECT_ID, salesShipmentId: ACTIVE_SHIPMENT, type: "CINV", state: "APPROVED", cancelled: false }],
    customerInvoiceBalances: [{ documentId: "cinv-active", outstanding: "0.000000" }],
    ...overrides,
  });
}

test("a shipment is financially closed only with an approved non-cancelled CINV and exact zero aggregate outstanding", async () => {
  const state = await (await subject()).financialState(PROJECT_ID);
  assert.deepEqual(state, {
    projectId: PROJECT_ID,
    state: "FINANCIALLY_CLOSED",
    shipments: [{ shipmentId: ACTIVE_SHIPMENT, state: "FINANCIALLY_CLOSED", approvedCinvCount: 1, customerOutstanding: "0.000000" }],
  });
});

test("zero outstanding without an approved CINV remains OPEN", async () => {
  const service = await subject({ documents: [], customerInvoiceBalances: [] });
  const state = await service.financialState(PROJECT_ID);
  assert.equal(state.state, "OPEN");
  assert.deepEqual(state.shipments, [{ shipmentId: ACTIVE_SHIPMENT, state: "OPEN", approvedCinvCount: 0, customerOutstanding: "0.000000" }]);
});

test("non-zero customer outstanding keeps shipment and Project open independently of final-close state", async () => {
  const service = await subject({
    projects: [{ id: PROJECT_ID, version: 20, state: "FINAL_CLOSED" }],
    customerInvoiceBalances: [{ documentId: "cinv-active", outstanding: "0.000001" }],
  });
  const state = await service.financialState(PROJECT_ID);
  assert.equal(state.state, "OPEN");
  assert.equal(state.shipments[0].state, "OPEN");
  assert.equal(state.shipments[0].customerOutstanding, "0.000001");
});

test("cancelled shipments are excluded and every active shipment must close", async () => {
  const second = "019a6000-0000-7000-8000-000000000004";
  const service = await subject({
    salesShipments: [
      { id: ACTIVE_SHIPMENT, projectId: PROJECT_ID, executionState: "DELIVERED" },
      { id: second, projectId: PROJECT_ID, executionState: "IN_TRANSIT" },
      { id: CANCELLED_SHIPMENT, projectId: PROJECT_ID, executionState: "CANCELLED" },
    ],
  });
  const state = await service.financialState(PROJECT_ID);
  assert.equal(state.state, "OPEN");
  assert.deepEqual(state.shipments.map((item) => item.shipmentId), [ACTIVE_SHIPMENT, second]);
});
