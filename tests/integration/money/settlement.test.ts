import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000007301";
const CUSTOMER_ID = "019a5f9b-7c00-7000-8000-000000007302";
const SUPPLIER_ID = "019a5f9b-7c00-7000-8000-000000007303";
const SALES_CONTRACT_ID = "019a5f9b-7c00-7000-8000-000000007304";
const PURCHASE_CONTRACT_ID = "019a5f9b-7c00-7000-8000-000000007305";
const CINV_A = "019a5f9b-7c00-7000-8000-000000007306";
const CINV_B = "019a5f9b-7c00-7000-8000-000000007307";
const SUPPLIER_INVOICE = "019a5f9b-7c00-7000-8000-000000007308";
const SALES_SHIPMENT = "019a5f9b-7c00-7000-8000-000000007309";
const FINANCE = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000007310", roles: ["FINANCE_VIEWER"] });

type Result = { value: any; replayed: boolean };
interface SettlementService {
  recordMovement(input: Record<string, unknown>): Promise<Result>;
  allocate(input: Record<string, unknown>): Promise<Result>;
  reverseAllocation(input: Record<string, unknown>): Promise<Result>;
  reverseMovement(input: Record<string, unknown>): Promise<Result>;
  getMovement(id: string): Promise<any>;
  getAllocation(id: string): Promise<any>;
  getTarget(type: string, id: string): Promise<any>;
  projectFinancialState(projectId: string): Promise<any>;
  statement(projectId: string, currency: string): Promise<any>;
  auditTrail(): Promise<readonly any[]>;
}
interface SettlementModule { createInMemorySettlementService(options: Record<string, unknown>): SettlementService }
async function loadMoney(): Promise<SettlementModule> {
  return import("../../../src/modules/money/settlement-repository.ts") as Promise<SettlementModule>;
}
function command(key: string) { return { principal: FINANCE, idempotencyKey: key, correlationId: key }; }
function problem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code &&
    (status === undefined || error.problem.status === status);
}
async function subject() {
  const module = await loadMoney();
  return module.createInMemorySettlementService({
    now: () => "2026-11-07T14:00:00.000Z",
    projects: [{ id: PROJECT_ID, version: 8, finalState: "FINAL_CLOSED" }],
    contracts: [
      { id: SALES_CONTRACT_ID, projectId: PROJECT_ID, partyId: CUSTOMER_ID, partyType: "CUSTOMER", currency: "USD" },
      { id: PURCHASE_CONTRACT_ID, projectId: PROJECT_ID, partyId: SUPPLIER_ID, partyType: "SUPPLIER", currency: "USD" },
    ],
    targets: [
      { type: "CINV", id: CINV_A, projectId: PROJECT_ID, partyId: CUSTOMER_ID, currency: "USD", amount: "600.000000", outstanding: "600.000000", salesShipmentId: SALES_SHIPMENT },
      { type: "CINV", id: CINV_B, projectId: PROJECT_ID, partyId: CUSTOMER_ID, currency: "USD", amount: "500.000000", outstanding: "500.000000", salesShipmentId: SALES_SHIPMENT },
      { type: "SUPPLIER_INVOICE", id: SUPPLIER_INVOICE, projectId: PROJECT_ID, partyId: SUPPLIER_ID, currency: "USD", amount: "400.000000", outstanding: "400.000000" },
    ],
  });
}
async function movement(service: SettlementService, overrides: Record<string, unknown> = {}, key = "movement-record-0001") {
  return (await service.recordMovement({
    projectId: PROJECT_ID, expectedVersion: 8, partyId: CUSTOMER_ID, contractId: SALES_CONTRACT_ID,
    kind: "CUSTOMER_ADVANCE", amount: "1000.000000", currency: "USD", occurredOn: "2026-11-07",
    reference: "BANK-REF-001", ...overrides, ...command(key),
  })).value;
}

test("records an exact confirmed movement before invoices and replays without a duplicate effect", async () => {
  const service = await subject();
  const first = await movement(service);
  assert.equal(first.state, "CONFIRMED");
  assert.equal(first.availableAmount, "1000.000000");
  const replay = await service.recordMovement({ projectId: PROJECT_ID, expectedVersion: 8, partyId: CUSTOMER_ID,
    contractId: SALES_CONTRACT_ID, kind: "CUSTOMER_ADVANCE", amount: "1000.000000", currency: "USD",
    occurredOn: "2026-11-07", reference: "BANK-REF-001", ...command("movement-record-0001") });
  assert.equal(replay.replayed, true);
  assert.equal(replay.value.id, first.id);
  assert.equal((await service.statement(PROJECT_ID, "USD")).movements.length, 1);
});

test("partial many-to-many allocation preserves exact movement availability and document outstanding", async () => {
  const service = await subject();
  const receipt = await movement(service);
  const a = await service.allocate({ movementId: receipt.id, expectedVersion: receipt.version, targetType: "CINV",
    targetId: CINV_A, amount: "400.000000", currency: "USD", ...command("allocate-cinv-a-0001") });
  const afterA = await service.getMovement(receipt.id);
  const b = await service.allocate({ movementId: receipt.id, expectedVersion: afterA.version, targetType: "CINV",
    targetId: CINV_B, amount: "300.000000", currency: "USD", ...command("allocate-cinv-b-0001") });
  assert.equal(a.value.state, "ACTIVE");
  assert.equal(b.value.state, "ACTIVE");
  assert.equal((await service.getMovement(receipt.id)).availableAmount, "300.000000");
  assert.equal((await service.getTarget("CINV", CINV_A)).outstanding, "200.000000");
  assert.equal((await service.getTarget("CINV", CINV_B)).outstanding, "200.000000");
});

test("same-party and same-currency checks and both over-allocation guards fail closed", async () => {
  const service = await subject();
  const receipt = await movement(service);
  await assert.rejects(() => service.allocate({ movementId: receipt.id, expectedVersion: receipt.version,
    targetType: "SUPPLIER_INVOICE", targetId: SUPPLIER_INVOICE, amount: "10.000000", currency: "USD",
    ...command("allocate-wrong-party") }), problem("ALLOCATION_PARTY_OR_CURRENCY_MISMATCH", 409));
  await assert.rejects(() => service.allocate({ movementId: receipt.id, expectedVersion: receipt.version,
    targetType: "CINV", targetId: CINV_A, amount: "10.000000", currency: "AED",
    ...command("allocate-wrong-currency") }), problem("ALLOCATION_PARTY_OR_CURRENCY_MISMATCH", 409));
  await assert.rejects(() => service.allocate({ movementId: receipt.id, expectedVersion: receipt.version,
    targetType: "CINV", targetId: CINV_A, amount: "700.000000", currency: "USD",
    ...command("allocate-over-document") }), problem("ALLOCATION_EXCEEDS_AVAILABLE", 409));
  const full = await service.allocate({ movementId: receipt.id, expectedVersion: receipt.version,
    targetType: "CINV", targetId: CINV_A, amount: "600.000000", currency: "USD",
    ...command("allocate-full-document") });
  const afterFull = await service.getMovement(receipt.id);
  await assert.rejects(() => service.allocate({ movementId: receipt.id, expectedVersion: afterFull.version,
    targetType: "CINV", targetId: CINV_B, amount: "500.000000", currency: "USD",
    ...command("allocate-over-movement") }), problem("ALLOCATION_EXCEEDS_AVAILABLE", 409));
  assert.equal(full.value.amount, "600.000000");
  assert.equal((await service.getMovement(receipt.id)).availableAmount, "400.000000");
  assert.equal((await service.getTarget("CINV", CINV_B)).outstanding, "500.000000");
});

test("allocation reversal appends one compensating row and atomically reopens financial/final closure", async () => {
  const service = await subject();
  const receipt = await movement(service, { amount: "600.000000", kind: "CUSTOMER_RECEIPT" }, "movement-close-0001");
  const allocated = await service.allocate({ movementId: receipt.id, expectedVersion: receipt.version, targetType: "CINV",
    targetId: CINV_A, amount: "600.000000", currency: "USD", ...command("allocation-close-0001") });
  assert.equal((await service.getTarget("CINV", CINV_A)).outstanding, "0.000000");
  const reversed = await service.reverseAllocation({ allocationId: allocated.value.id, expectedVersion: allocated.value.version,
    reason: "Receipt returned by customer", ...command("allocation-reverse-0001") });
  const replay = await service.reverseAllocation({ allocationId: allocated.value.id, expectedVersion: allocated.value.version,
    reason: "Receipt returned by customer", ...command("allocation-reverse-0001") });
  assert.equal(reversed.value.reversalOfId, allocated.value.id);
  assert.equal(reversed.value.amount, "-600.000000");
  assert.equal(replay.replayed, true);
  assert.equal((await service.getAllocation(allocated.value.id)).state, "ACTIVE", "original allocation remains immutable");
  assert.equal((await service.getTarget("CINV", CINV_A)).outstanding, "600.000000");
  assert.equal((await service.getMovement(receipt.id)).availableAmount, "600.000000");
  assert.deepEqual(await service.projectFinancialState(PROJECT_ID), { shipmentState: "OPEN", projectState: "ACTIVE", finalState: "OPEN" });
  await assert.rejects(() => service.reverseAllocation({ allocationId: allocated.value.id, expectedVersion: allocated.value.version,
    reason: "Second reversal forbidden", ...command("allocation-reverse-0002") }), problem("ALLOCATION_ALREADY_REVERSED", 409));
});

test("movement reversal reverses all active allocations atomically and preserves append-only history", async () => {
  const service = await subject();
  const receipt = await movement(service);
  const first = await service.allocate({ movementId: receipt.id, expectedVersion: receipt.version, targetType: "CINV",
    targetId: CINV_A, amount: "400.000000", currency: "USD", ...command("movement-reverse-a") });
  const current = await service.getMovement(receipt.id);
  await service.allocate({ movementId: receipt.id, expectedVersion: current.version, targetType: "CINV",
    targetId: CINV_B, amount: "300.000000", currency: "USD", ...command("movement-reverse-b") });
  const reversed = await service.reverseMovement({ movementId: receipt.id, expectedVersion: (await service.getMovement(receipt.id)).version,
    reason: "Bank recalled the receipt", ...command("movement-reversal-0001") });
  assert.equal(reversed.value.reversalOfId, receipt.id);
  assert.equal((await service.getMovement(receipt.id)).state, "REVERSED");
  assert.equal((await service.getAllocation(first.value.id)).state, "ACTIVE");
  assert.equal((await service.getTarget("CINV", CINV_A)).outstanding, "600.000000");
  assert.equal((await service.getTarget("CINV", CINV_B)).outstanding, "500.000000");
  const audit = await service.auditTrail();
  assert.ok(audit.some((event) => event.action === "MONEY_MOVEMENT_REVERSED"));
  assert.equal(audit.filter((event) => event.action === "SETTLEMENT_ALLOCATION_COMPENSATED").length, 2);
});
