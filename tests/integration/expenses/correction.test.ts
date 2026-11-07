import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000008101";
const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000008102";
const VENDOR_ID = "019a5f9b-7c00-7000-8000-000000008103";
const ORIGINAL_EVIDENCE = "019a5f9b-7c00-7000-8000-000000008104";
const REPLACEMENT_EVIDENCE = "019a5f9b-7c00-7000-8000-000000008105";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008106", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008107", roles: ["OWNER_ADMIN"] });

type Result = { value: any; replayed: boolean };
interface CorrectionService {
  create(input: Record<string, unknown>): Promise<Result>;
  submitForApproval(input: Record<string, unknown>): Promise<Result>;
  decideApproval(input: Record<string, unknown>): Promise<any>;
  submitCorrection(input: Record<string, unknown>): Promise<Result>;
  applyCorrection(input: Record<string, unknown>): Promise<Result>;
  get(expenseId: string): Promise<any>;
  getCorrection(correctionId: string): Promise<any>;
  listProject(projectId: string): Promise<readonly any[]>;
  statement(projectId: string, currency: string): Promise<any>;
  margin(projectId: string, currency: string): Promise<any>;
  closure(projectId: string): Promise<any>;
  auditTrail(): Promise<readonly any[]>;
}
interface CorrectionModule { createInMemoryExpenseCorrectionService(options: Record<string, unknown>): CorrectionService }
async function subject(): Promise<CorrectionService> {
  const module = await import("../../../src/modules/expenses/correction-service.ts") as CorrectionModule;
  return module.createInMemoryExpenseCorrectionService({
    now: () => "2026-11-07T17:00:00.000Z",
    projects: [{ id: PROJECT_ID, version: 9, finalState: "FINAL_CLOSED", closureAssessmentId: "assessment-1" }],
    salesShipments: [{ id: SHIPMENT_ID, projectId: PROJECT_ID }], vendors: [{ id: VENDOR_ID, active: true }],
    categories: [{ code: "FREIGHT", active: true }, { code: "INSPECTION", active: true }],
    evidence: [
      { id: ORIGINAL_EVIDENCE, projectId: PROJECT_ID, state: "AVAILABLE", sha256: "c".repeat(64) },
      { id: REPLACEMENT_EVIDENCE, projectId: PROJECT_ID, state: "AVAILABLE", sha256: "d".repeat(64) },
    ],
  });
}
const command = (key: string, principal = OPERATIONS) => ({ principal, idempotencyKey: key, correlationId: key });
const problem = (code: string, status?: number) => (error: unknown) => error instanceof ProblemError
  && error.problem.code === code && (status === undefined || error.problem.status === status);
async function original(service: CorrectionService) {
  const draft = await service.create({ projectId: PROJECT_ID, expectedVersion: 9, scope: "SALES_SHIPMENT", salesShipmentId: SHIPMENT_ID,
    vendorId: VENDOR_ID, categoryCode: "FREIGHT", amount: "500.000000", currency: "USD", occurredOn: "2026-11-01",
    evidenceId: ORIGINAL_EVIDENCE, ...command("correction-original-create") });
  const pending = await service.submitForApproval({ expenseId: draft.value.id, expectedVersion: draft.value.version, ...command("correction-original-submit") });
  await service.decideApproval({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED" });
  return service.get(draft.value.id);
}
function replacement() {
  return { scope: "SALES_SHIPMENT", salesShipmentId: SHIPMENT_ID, vendorId: VENDOR_ID, categoryCode: "INSPECTION",
    amount: "575.250000", currency: "USD", occurredOn: "2026-11-02", evidenceId: REPLACEMENT_EVIDENCE };
}
async function approvedCorrection(service: CorrectionService, row: any) {
  const pending = await service.submitCorrection({ expenseId: row.id, expectedVersion: row.version,
    reason: "Correct category and supplier amount", replacement: replacement(), ...command("correction-submit") });
  assert.equal(pending.value.actionCode, "DIRECT_EXPENSE_CORRECTION");
  assert.equal(pending.value.subjectId, row.id);
  await assert.rejects(
    () => service.decideApproval({ approvalId: pending.value.id, approver: OPERATIONS, decision: "APPROVED" }),
    problem("SELF_APPROVAL_FORBIDDEN", 409),
  );
  await service.decideApproval({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED" });
  return pending.value;
}

test("correction approval binds the immutable exact old/new expense pair and both proofs", async () => {
  const service = await subject();
  const before = await original(service);
  const approval = await approvedCorrection(service, before);
  const correction = await service.getCorrection(approval.correctionId);
  assert.equal(correction.originalExpenseId, before.id);
  assert.equal(correction.reason, "Correct category and supplier amount");
  assert.match(correction.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(correction.originalEvidenceId, ORIGINAL_EVIDENCE);
  assert.equal(correction.replacementEvidenceId, REPLACEMENT_EVIDENCE);
  assert.equal((await service.get(before.id)).state, "APPROVED", "submission alone cannot cancel the original");
});

test("approved apply atomically cancels original and approves one bidirectionally linked replacement", async () => {
  const service = await subject();
  const before = await original(service);
  const approval = await approvedCorrection(service, before);
  const applied = await service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: approval.id, ...command("correction-apply") });
  const old = await service.get(before.id);
  const next = await service.get(applied.value.replacementExpenseId);
  assert.equal(old.state, "CANCELLED");
  assert.equal(old.replacedByExpenseId, next.id);
  assert.equal(old.cancellationReason, "Correct category and supplier amount");
  assert.equal(next.state, "APPROVED");
  assert.equal(next.replacesExpenseId, old.id);
  assert.equal(old.evidenceId, ORIGINAL_EVIDENCE);
  assert.equal(next.evidenceId, REPLACEMENT_EVIDENCE);
  assert.equal((await service.listProject(PROJECT_ID)).length, 2);
});

test("stale, unapproved, mismatched and repeated apply fail closed without partial replacement", async () => {
  const service = await subject();
  const before = await original(service);
  const submitted = await service.submitCorrection({ expenseId: before.id, expectedVersion: before.version,
    reason: "Correct category and supplier amount", replacement: replacement(), ...command("correction-guard-submit") });
  await assert.rejects(() => service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: submitted.value.id, ...command("correction-unapproved-apply") }), problem("APPROVAL_REQUIRED", 409));
  await service.decideApproval({ approvalId: submitted.value.id, approver: OWNER, decision: "APPROVED" });
  await assert.rejects(() => service.applyCorrection({ expenseId: before.id, expectedVersion: before.version - 1,
    approvalId: submitted.value.id, ...command("correction-stale-apply") }), problem("STALE_VERSION", 412));
  await assert.rejects(() => service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: "019a5f9b-7c00-7000-8000-000000008199", ...command("correction-wrong-approval") }), problem("APPROVAL_VERSION_MISMATCH", 409));
  const applied = await service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: submitted.value.id, ...command("correction-exact-apply") });
  await assert.rejects(() => service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: submitted.value.id, ...command("correction-second-apply") }), problem("INVALID_STATE_TRANSITION", 409));
  assert.equal((await service.listProject(PROJECT_ID)).filter((row: any) => row.replacesExpenseId === before.id).length, 1);
  assert.ok(applied.value.replacementExpenseId);
});

test("idempotent apply replays one replacement and one audit effect", async () => {
  const service = await subject();
  const before = await original(service);
  const approval = await approvedCorrection(service, before);
  const input = { expenseId: before.id, expectedVersion: before.version, approvalId: approval.id, ...command("correction-replay-apply") };
  const first = await service.applyCorrection(input);
  const replay = await service.applyCorrection(input);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  assert.equal((await service.listProject(PROJECT_ID)).length, 2);
  assert.equal((await service.auditTrail()).filter((event: any) => event.action === "DIRECT_EXPENSE_CORRECTION_APPLIED").length, 1);
});

test("apply recomputes statements and margin and invalidates Final Close in the same command", async () => {
  const service = await subject();
  const before = await original(service);
  const approval = await approvedCorrection(service, before);
  const applied = await service.applyCorrection({ expenseId: before.id, expectedVersion: before.version,
    approvalId: approval.id, ...command("correction-projection-apply") });
  const statement = await service.statement(PROJECT_ID, "USD");
  assert.deepEqual(statement.lines.map((line: any) => line.sourceId), [applied.value.replacementExpenseId]);
  assert.equal(statement.balance, "575.250000");
  assert.equal((await service.margin(PROJECT_ID, "USD")).approvedExpenses, "575.250000");
  assert.deepEqual(await service.closure(PROJECT_ID), { finalState: "OPEN", assessmentValid: false, expensesComplete: true });
});

test("direct update/delete and shared allocation methods are intentionally absent", async () => {
  const service = await subject();
  assert.equal((service as any).update, undefined);
  assert.equal((service as any).delete, undefined);
  assert.equal((service as any).allocateExpense, undefined);
});
