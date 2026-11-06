import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000701", displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000702", displayName: "Owner", roles: ["OWNER_ADMIN"] });
const OTHER_OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000703", displayName: "Other Owner", roles: ["OWNER_ADMIN"] });
const SUPPLIER_ID = "019a5f9b-7c00-7000-8000-000000000711";
const SALES_ID = "019a5f9b-7c00-7000-8000-000000000712";
const SUPPLIER_DATASET = "019a5f9b-7c00-7000-8000-000000000721";
const SALES_DATASET = "019a5f9b-7c00-7000-8000-000000000722";
const SOURCE_ID = "019a5f9b-7c00-7000-8000-000000000731";

type Principal = typeof OPERATIONS;
interface ConfirmationService {
  submitSupplierConfirmation(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  submitSalesConfirmation(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  applyDecision(input: Record<string, unknown>): Promise<any>;
  confirmSupplier(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  confirmSales(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  getWorkspace(kind: "SUPPLIER" | "SALES", id: string): Promise<any>;
}
interface ConfirmationModule {
  createInMemoryShipmentConfirmationService(options: Record<string, unknown>): ConfirmationService;
  readShipmentConfirmationState(service: ConfirmationService): Readonly<{ approvals: readonly any[]; shipments: readonly any[] }>;
}
async function loadModule(): Promise<ConfirmationModule> {
  return import("../../../src/modules/shipments/confirmation-service.ts") as Promise<ConfirmationModule>;
}
function command(key: string, principal: Principal = OPERATIONS) {
  return { principal, idempotencyKey: key, correlationId: key };
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status);
}
async function subject() {
  const module = await loadModule();
  const service = module.createInMemoryShipmentConfirmationService({
    now: () => "2026-11-06T14:00:00.000Z",
    shipments: [
      { id: SUPPLIER_ID, kind: "SUPPLIER", projectId: "project-a", version: 1, executionState: "DRAFT", activeDataset: { datasetId: SUPPLIER_DATASET, revisionNo: 1, datasetHash: "a".repeat(64), quantity: "40.000000" }, contractedQuantity: "100.000000" },
      { id: SALES_ID, kind: "SALES", projectId: "project-a", version: 1, executionState: "DRAFT", primarySupplierShipmentId: SOURCE_ID, activeDataset: { datasetId: SALES_DATASET, revisionNo: 1, datasetHash: "b".repeat(64), quantity: "20.000000" }, contractedQuantity: "100.000000" },
    ],
    supplierSources: [{ id: SOURCE_ID, projectId: "project-a", executionState: "CONFIRMED", coffeeSpecificationId: "coffee-a" }],
  });
  return { module, service };
}

test("submissions bind approval to the exact active dataset and sales source", async () => {
  const { service } = await subject();
  const supplier = await service.submitSupplierConfirmation({ shipmentId: SUPPLIER_ID, expectedVersion: 1, ...command("supplier-submit-exact") });
  assert.deepEqual({ actionCode: supplier.value.actionCode, subjectId: supplier.value.subjectId, subjectVersion: supplier.value.subjectVersion, subjectHash: supplier.value.subjectHash }, {
    actionCode: "SUPPLIER_SHIPMENT_CONFIRMATION", subjectId: SUPPLIER_DATASET, subjectVersion: 1, subjectHash: "a".repeat(64),
  });
  const sales = await service.submitSalesConfirmation({ shipmentId: SALES_ID, expectedVersion: 1, ...command("sales-submit-exact") });
  assert.equal(sales.value.actionCode, "SALES_SHIPMENT_CONFIRMATION");
  assert.equal(sales.value.subjectId, SALES_DATASET);
  assert.equal(sales.value.boundSourceId, SOURCE_ID);
  assert.match(sales.value.subjectHash, /^[a-f0-9]{64}$/);
});

test("requester cannot approve and confirmation requires the current approved exact binding", async () => {
  const { service } = await subject();
  const pending = (await service.submitSupplierConfirmation({ shipmentId: SUPPLIER_ID, expectedVersion: 1, ...command("supplier-submit-separation") })).value;
  await assert.rejects(() => service.applyDecision({ approvalId: pending.id, approver: OPERATIONS, decision: "APPROVED", comment: "self" }), isProblem("SELF_APPROVAL_FORBIDDEN", 409));
  await assert.rejects(() => service.confirmSupplier({ shipmentId: SUPPLIER_ID, expectedVersion: 1, approvalId: pending.id, ...command("supplier-confirm-pending") }), isProblem("APPROVAL_REQUIRED", 409));
  const approved = await service.applyDecision({ approvalId: pending.id, approver: OWNER, decision: "APPROVED", comment: "Exact dataset approved" });
  await assert.rejects(() => service.confirmSupplier({ shipmentId: SUPPLIER_ID, expectedVersion: 1, approvalId: "019a5f9b-7c00-7000-8000-000000000799", ...command("supplier-confirm-wrong") }), isProblem("APPROVAL_VERSION_MISMATCH", 409));
  const confirmed = await service.confirmSupplier({ shipmentId: SUPPLIER_ID, expectedVersion: 1, approvalId: approved.id, ...command("supplier-confirm-approved") });
  assert.equal(confirmed.value.executionState, "CONFIRMED");
});

test("sales confirmation fails without one current source or exact approval and replays safely", async () => {
  const { service } = await subject();
  const pending = (await service.submitSalesConfirmation({ shipmentId: SALES_ID, expectedVersion: 1, ...command("sales-submit-confirm") })).value;
  const approved = await service.applyDecision({ approvalId: pending.id, approver: OTHER_OWNER, decision: "APPROVED", comment: "Exact source binding approved" });
  await assert.rejects(() => service.confirmSales({ shipmentId: SALES_ID, expectedVersion: 1, approvalId: pending.id, primarySupplierShipmentId: null, ...command("sales-confirm-no-source") }), isProblem("PRIMARY_SOURCE_REQUIRED", 409));
  const input = { shipmentId: SALES_ID, expectedVersion: 1, approvalId: approved.id, ...command("sales-confirm-exact") };
  const first = await service.confirmSales(input);
  const replay = await service.confirmSales(input);
  assert.equal(first.value.executionState, "CONFIRMED");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
});

test("confirmation updates contracted, confirmed, delivered, cancelled, rejected and remaining totals without deleting terminal rows", async () => {
  const { service } = await subject();
  const pending = (await service.submitSupplierConfirmation({ shipmentId: SUPPLIER_ID, expectedVersion: 1, ...command("supplier-submit-totals") })).value;
  const approved = await service.applyDecision({ approvalId: pending.id, approver: OWNER, decision: "APPROVED", comment: "Approved" });
  const confirmed = await service.confirmSupplier({ shipmentId: SUPPLIER_ID, expectedVersion: 1, approvalId: approved.id, ...command("supplier-confirm-totals") });
  assert.deepEqual(confirmed.value.quantities, {
    contracted: "100.000000", confirmed: "40.000000", deliveredOrReceived: "0.000000",
    cancelled: "0.000000", rejected: "0.000000", remaining: "60.000000",
  });
});
