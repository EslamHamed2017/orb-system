import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const DATASET_ID = "019a5f9b-7c00-7000-8000-000000000801";
const SOURCE_ID = "019a5f9b-7c00-7000-8000-000000000802";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000803", displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000804", displayName: "Owner", roles: ["OWNER_ADMIN"] });
interface ToleranceModule {
  evaluateShipmentTolerance(input: Record<string, unknown>): Readonly<{ withinTolerance: boolean; breaches: readonly any[]; bindingHash: string }>;
  createInMemoryToleranceExceptionService(options: Record<string, unknown>): {
    requestException(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
    applyDecision(input: Record<string, unknown>): Promise<any>;
    assertConfirmationAllowed(input: Record<string, unknown>): Promise<void>;
  };
}
async function loadModule(): Promise<ToleranceModule> {
  return import("../../../src/modules/shipments/tolerance.ts") as Promise<ToleranceModule>;
}
function isProblem(code: string) { return (error: unknown) => error instanceof ProblemError && error.problem.code === code; }
function evaluationInput(actual: Record<string, string> = {}) {
  return {
    datasetId: DATASET_ID, datasetVersion: 3, sourceId: SOURCE_ID,
    contracted: { quantity: "100.000000", netWeight: "50000.000000", grossWeight: "50500.000000" },
    actual: { quantity: "100.000000", netWeight: "50000.000000", grossWeight: "50500.000000", ...actual },
    tolerances: { quantityUnder: "1.000000", quantityOver: "2.000000", netWeightUnder: "500.000000", netWeightOver: "500.000000", grossWeightUnder: "500.000000", grossWeightOver: "500.000000" },
  };
}

test("tolerance evaluation reports exact breached fields, bounds and values and binds them to dataset and source", async () => {
  const module = await loadModule();
  const result = module.evaluateShipmentTolerance(evaluationInput({ quantity: "103.000000", netWeight: "49499.000000" }));
  assert.equal(result.withinTolerance, false);
  assert.deepEqual(result.breaches, [
    { field: "quantity", allowedLower: "99.000000", allowedUpper: "102.000000", actual: "103.000000", datasetVersion: 3 },
    { field: "netWeight", allowedLower: "49500.000000", allowedUpper: "50500.000000", actual: "49499.000000", datasetVersion: 3 },
  ]);
  assert.match(result.bindingHash, /^[a-f0-9]{64}$/);
});

test("boundary values pass and omitted zero tolerance rejects any variance", async () => {
  const module = await loadModule();
  assert.equal(module.evaluateShipmentTolerance(evaluationInput({ quantity: "99.000000", grossWeight: "51000.000000" })).withinTolerance, true);
  const exactOnly = evaluationInput({ quantity: "100.000001" });
  exactOnly.tolerances = { quantityUnder: "0", quantityOver: "0", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" };
  assert.deepEqual(module.evaluateShipmentTolerance(exactOnly).breaches.map((row: any) => row.field), ["quantity"]);
});

test("outside-tolerance confirmation is blocked until an approved exact exception exists", async () => {
  const module = await loadModule();
  const evaluation = module.evaluateShipmentTolerance(evaluationInput({ quantity: "103.000000" }));
  const service = module.createInMemoryToleranceExceptionService({ now: () => "2026-11-06T14:30:00.000Z" });
  await assert.rejects(() => service.assertConfirmationAllowed({ evaluation, datasetId: DATASET_ID, sourceId: SOURCE_ID }), isProblem("OUTSIDE_TOLERANCE_APPROVAL_REQUIRED"));
  const pending = (await service.requestException({ evaluation, reason: "Customer accepted quantity variance", breachedFields: ["quantity"], principal: OPERATIONS, idempotencyKey: "tolerance-request-exact", correlationId: "tolerance-request-exact" })).value;
  await assert.rejects(() => service.assertConfirmationAllowed({ evaluation, approvalId: pending.id, datasetId: DATASET_ID, sourceId: SOURCE_ID }), isProblem("OUTSIDE_TOLERANCE_APPROVAL_REQUIRED"));
  const approved = await service.applyDecision({ approvalId: pending.id, approver: OWNER, decision: "APPROVED", comment: "Accepted exact breach" });
  await service.assertConfirmationAllowed({ evaluation, approvalId: approved.id, datasetId: DATASET_ID, sourceId: SOURCE_ID });
});

test("exception applies only to its bound breached values, field set, dataset, source and reason", async () => {
  const module = await loadModule();
  const evaluation = module.evaluateShipmentTolerance(evaluationInput({ quantity: "103.000000" }));
  const service = module.createInMemoryToleranceExceptionService({ now: () => "2026-11-06T14:30:00.000Z" });
  await assert.rejects(() => service.requestException({ evaluation, reason: "ok", breachedFields: ["quantity"], principal: OPERATIONS, idempotencyKey: "tolerance-short-reason", correlationId: "tolerance-short-reason" }), isProblem("VALIDATION_FAILED"));
  await assert.rejects(() => service.requestException({ evaluation, reason: "Wrong field", breachedFields: ["netWeight"], principal: OPERATIONS, idempotencyKey: "tolerance-wrong-field", correlationId: "tolerance-wrong-field" }), isProblem("VALIDATION_FAILED"));
  const pending = (await service.requestException({ evaluation, reason: "Accepted quantity variance", breachedFields: ["quantity"], principal: OPERATIONS, idempotencyKey: "tolerance-bound-values", correlationId: "tolerance-bound-values" })).value;
  const approved = await service.applyDecision({ approvalId: pending.id, approver: OWNER, decision: "APPROVED", comment: "Approved" });
  for (const changed of [
    { evaluation: module.evaluateShipmentTolerance(evaluationInput({ quantity: "104.000000" })), datasetId: DATASET_ID, sourceId: SOURCE_ID },
    { evaluation, datasetId: "019a5f9b-7c00-7000-8000-000000000899", sourceId: SOURCE_ID },
    { evaluation, datasetId: DATASET_ID, sourceId: "019a5f9b-7c00-7000-8000-000000000898" },
  ]) await assert.rejects(() => service.assertConfirmationAllowed({ ...changed, approvalId: approved.id }), isProblem("APPROVAL_VERSION_MISMATCH"));
});
