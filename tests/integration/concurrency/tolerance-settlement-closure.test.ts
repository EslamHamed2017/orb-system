import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import { evaluateShipmentTolerance, createInMemoryToleranceExceptionService } from "../../../src/modules/shipments/tolerance.ts";
import { createInMemorySettlementService } from "../../../src/modules/money/settlement-repository.ts";
import { createInMemoryClosureService } from "../../../src/modules/closure/closure-service.ts";
import { createApprovedSendHarness } from "../../../src/modules/outbound/send-service.ts";
import { assertR1Thresholds, percentile, runR1Load } from "../../performance/r1-load.ts";

const OWNER = Object.freeze({ userId: "owner", roles: ["OWNER_ADMIN"] });
const OPERATIONS = Object.freeze({ userId: "operations", roles: ["OPERATIONS"] });
const FINANCE = Object.freeze({ userId: "finance", roles: ["FINANCE_VIEWER"] });
const problem = (code: string) => (error: unknown) => error instanceof ProblemError && error.problem.code === code;

test("50-session dry run collects every timing class and enforces accepted percentiles", async () => {
  const report = await runR1Load({
    sessionCount: 50,
    iterationsPerSession: 2,
    invoke: async ({ kind, sessionId, iteration }) => ({
      durationMs: { read: 120, mutation: 240, documentAccept: 600, documentRender: 4_000 }[kind] + sessionId + iteration,
      ok: true,
    }),
  });
  assert.equal(report.sessionCount, 50);
  assert.deepEqual(Object.fromEntries(Object.entries(report.metrics).map(([key, value]) => [key, value.count])), {
    read: 100, mutation: 100, documentAccept: 100, documentRender: 100,
  });
  assert.equal(report.failures.length, 0);
  assert.equal(report.thresholdsPassed, true);
  assert.doesNotMatch(JSON.stringify(report), /cookie|csrf|authorization|password|token/i);
  assert.doesNotThrow(() => assertR1Thresholds(report));
});

test("percentile and threshold checks fail closed on missing, failed, or slow samples", async () => {
  assert.equal(percentile([1, 2, 3, 4, 100], 0.95), 100);
  await assert.rejects(() => runR1Load({ sessionCount: 49, iterationsPerSession: 1, invoke: async () => ({ durationMs: 1, ok: true }) }), /exactly 50 sessions/);
  const report = await runR1Load({
    sessionCount: 50, iterationsPerSession: 1,
    invoke: async ({ kind, sessionId }) => ({ durationMs: kind === "read" && sessionId === 49 ? 501 : 1, ok: !(kind === "mutation" && sessionId === 1), failureCode: "EXPECTED_DRY_RUN_FAILURE" }),
  });
  assert.equal(report.thresholdsPassed, false);
  assert.throws(() => assertR1Thresholds(report), /performance or invariant threshold failed/);
});

test("concurrent settlement commands permit one exact allocation and reject the stale competitor without overspend", async () => {
  const projectId = "project", customerId = "customer", contractId = "contract", targetId = "cinv";
  const service = createInMemorySettlementService({
    now: () => "2026-11-08T00:00:00.000Z",
    projects: [{ id: projectId, version: 1, finalState: "OPEN" }],
    contracts: [{ id: contractId, projectId, partyId: customerId, partyType: "CUSTOMER", currency: "USD" }],
    targets: [{ type: "CINV", id: targetId, projectId, partyId: customerId, currency: "USD", amount: "100.000000", outstanding: "100.000000" }],
  });
  const movement = (await service.recordMovement({ projectId, expectedVersion: 1, partyId: customerId, contractId, kind: "CUSTOMER_RECEIPT", amount: "100.000000", currency: "USD", occurredOn: "2026-11-08", reference: "LOAD-1", principal: FINANCE, idempotencyKey: "movement-load-1" })).value;
  const results = await Promise.allSettled(["a", "b"].map((suffix) => service.allocate({ movementId: movement.id, expectedVersion: 1, targetType: "CINV", targetId, amount: "100.000000", currency: "USD", principal: FINANCE, idempotencyKey: `allocation-${suffix}` })));
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(results.filter((row) => row.status === "rejected" && problem("STALE_VERSION")(row.reason)).length, 1);
  assert.equal((await service.getMovement(movement.id)).availableAmount, "0.000000");
  assert.equal((await service.getTarget("CINV", targetId)).outstanding, "0.000000");
});

test("concurrent tolerance decisions preserve one terminal decision and exact approval binding", async () => {
  const evaluation = evaluateShipmentTolerance({ datasetId: "dataset", datasetVersion: 1, sourceId: "source", contracted: { quantity: "10", netWeight: "10", grossWeight: "10" }, actual: { quantity: "12", netWeight: "10", grossWeight: "10" }, tolerances: { quantityUnder: "0", quantityOver: "0", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" } });
  const service = createInMemoryToleranceExceptionService({ now: () => "2026-11-08T00:00:00.000Z" });
  const pending = (await service.requestException({ evaluation, reason: "accepted variance", breachedFields: ["quantity"], principal: OPERATIONS, idempotencyKey: "tolerance-load" })).value;
  const decisions = await Promise.allSettled(["APPROVED", "REJECTED"].map((decision) => service.applyDecision({ approvalId: pending.id, approver: OWNER, decision })));
  assert.equal(decisions.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(decisions.filter((row) => row.status === "rejected" && problem("INVALID_STATE_TRANSITION")(row.reason)).length, 1);
  if (decisions[0].status === "fulfilled") await service.assertConfirmationAllowed({ evaluation, approvalId: pending.id, datasetId: "dataset", sourceId: "source" });
});

const completeClosure = {
  salesShipments: [{ id: "sales", projectId: "project", executionState: "DELIVERED" }], supplierShipments: [{ id: "supplier", projectId: "project", executionState: "RECEIVED" }],
  supplierInvoices: [{ id: "invoice", supplierShipmentId: "supplier", state: "CONFIRMED", cancelled: false, outstanding: "0.000000" }], routeItems: [{ id: "route", salesShipmentId: "sales", state: "SATISFIED" }],
  documents: [{ id: "cinv", projectId: "project", salesShipmentId: "sales", type: "CINV", state: "APPROVED", cancelled: false }, { id: "packing", projectId: "project", salesShipmentId: "sales", type: "PACKING_LIST", state: "APPROVED", cancelled: false }],
  customerInvoiceBalances: [{ documentId: "cinv", outstanding: "0.000000" }], expenses: [], claims: [], approvals: [], integrityFindings: [], securityFindings: [],
};
test("concurrent final-close commands create one effect and reject the stale competitor", async () => {
  const service = createInMemoryClosureService({ now: () => "2026-11-08T00:00:00.000Z", projects: [{ id: "project", version: 20, state: "FINANCIALLY_CLOSED", assessmentValid: false }], ...completeClosure });
  const assessment = (await service.assess({ projectId: "project", expectedVersion: 20, principal: OPERATIONS, idempotencyKey: "assess-load" })).value;
  const approval = (await service.submitFinalClose({ projectId: "project", expectedVersion: 20, assessmentId: assessment.id, principal: OPERATIONS, idempotencyKey: "submit-close-load" })).value;
  await service.decideApproval({ approvalId: approval.id, expectedVersion: approval.version, approver: OWNER, decision: "APPROVED", comment: "approved" });
  const closes = await Promise.allSettled(["a", "b"].map((suffix) => service.finalClose({ projectId: "project", expectedVersion: 20, assessmentId: assessment.id, approvalId: approval.id, principal: OWNER, idempotencyKey: `close-${suffix}` })));
  assert.equal(closes.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(closes.filter((row) => row.status === "rejected" && problem("STALE_VERSION")(row.reason)).length, 1);
  assert.equal((await service.project("project")).finalState, "FINAL_CLOSED");
});

test("adversarial document-send drift records failure without transport or mutable evidence loss", async () => {
  const bytes = new TextEncoder().encode("approved"); const sha = createHash("sha256").update(bytes).digest("hex");
  const harness = await createApprovedSendHarness({ now: () => "2026-11-08T00:00:00.000Z", document: { id: "document", version: 1, revisionId: "revision", revisionVersion: 1, sha256: sha, bytes }, attachment: { id: "attachment", version: 1, filename: "evidence.pdf", sha256: sha, bytes }, payload: { documentRevisionId: "revision", documentRevisionVersion: 1, outputSha256: sha, channel: "EMAIL", to: ["buyer@example.test"], cc: [], attachments: [{ id: "attachment", version: 1, filename: "evidence.pdf", byteLength: bytes.byteLength, sha256: sha }], subject: "Approved", body: { mediaType: "text/plain", contentBase64: Buffer.from(bytes).toString("base64"), byteLength: bytes.byteLength, sha256: sha } }, requester: OPERATIONS, approver: OWNER });
  harness.objects.replace("revision", new TextEncoder().encode("drift"));
  await assert.rejects(() => harness.service.send({ manifestId: harness.manifest.id, expectedVersion: harness.manifest.version, approvalId: harness.approval.id, principal: OPERATIONS, idempotencyKey: "send-load" }), problem("SEND_HASH_MISMATCH"));
  assert.equal(harness.transport.captures.length, 0);
  assert.equal((await harness.service.listAttempts(harness.manifest.id))[0].failureCode, "SEND_HASH_MISMATCH");
});
