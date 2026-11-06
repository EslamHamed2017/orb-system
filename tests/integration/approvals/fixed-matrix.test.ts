import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const IDS = Object.freeze({
  approval: "019a5f9b-7c00-7000-8000-000000000201",
  subject: "019a5f9b-7c00-7000-8000-000000000202",
  requester: "019a5f9b-7c00-7000-8000-000000000203",
  approver: "019a5f9b-7c00-7000-8000-000000000204",
});
const HASH = "a".repeat(64);

const EXPECTED_MATRIX = Object.freeze({
  CONTRACT_VERSION: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "CONTRACT_VERSION" },
  SUPPLIER_SHIPMENT_CONFIRMATION: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "SUPPLIER_SHIPMENT_DATASET" },
  SALES_SHIPMENT_CONFIRMATION: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "SALES_SHIPMENT_DATASET" },
  TOLERANCE_EXCEPTION: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "TOLERANCE_EXCEPTION" },
  SUPPLIER_INVOICE_CONFIRMATION: { requesterRoles: ["FINANCE_VIEWER"], approverRole: "OWNER_ADMIN", subjectType: "SUPPLIER_INVOICE" },
  DIRECT_EXPENSE: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "DIRECT_EXPENSE" },
  EXPENSE_CORRECTION: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "EXPENSE_CORRECTION" },
  DOCUMENT_OUTPUT: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "DOCUMENT_REVISION" },
  EXTERNAL_SEND: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "OUTBOUND_MANIFEST" },
  CLAIM_OUTCOME: { requesterRoles: ["OPERATIONS"], approverRole: "OWNER_ADMIN", subjectType: "CLAIM_OUTCOME_PROPOSAL" },
  CLOSURE_EXCEPTION: { requesterRoles: ["OPERATIONS", "FINANCE_VIEWER"], approverRole: "OWNER_ADMIN", subjectType: "CLOSURE_ASSESSMENT" },
  FINAL_CLOSE: { requesterRoles: ["OPERATIONS", "FINANCE_VIEWER"], approverRole: "OWNER_ADMIN", subjectType: "PROJECT" },
  REOPEN: { requesterRoles: ["OPERATIONS", "FINANCE_VIEWER"], approverRole: "OWNER_ADMIN", subjectType: "PROJECT" },
});

type Approval = Readonly<Record<string, unknown>>;
interface ActionCodesModule {
  readonly APPROVAL_ACTION_CODES: readonly string[];
  readonly FIXED_APPROVAL_MATRIX: Readonly<Record<string, {
    readonly requesterRoles: readonly string[];
    readonly approverRole: string;
    readonly subjectType: string;
  }>>;
}
interface ApprovalServiceModule {
  createApprovalRequest(input: Record<string, unknown>): Approval;
  decideApproval(input: {
    approval: Approval;
    approver: { userId: string; roles: readonly string[] };
    expectedVersion: number;
    currentSubject: { id: string; version: number; hash: string };
    decision: "APPROVED" | "REJECTED";
    comment: string;
    decidedAt: string;
    correlationId?: string;
  }): Approval;
  expireIfSubjectChanged(approval: Approval, currentSubject: { id: string; version: number; hash: string }, expiredAt: string): Approval;
}
async function loadActionCodes(): Promise<ActionCodesModule> {
  return import("../../../src/modules/approvals/action-codes.ts") as Promise<ActionCodesModule>;
}
async function loadApprovalService(): Promise<ApprovalServiceModule> {
  return import("../../../src/modules/approvals/approval-service.ts") as Promise<ApprovalServiceModule>;
}
function requestInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: IDS.approval,
    actionCode: "CONTRACT_VERSION",
    subject: { type: "CONTRACT_VERSION", id: IDS.subject, reference: "SC-001", version: 3, hash: HASH },
    requester: { userId: IDS.requester, displayName: "Operations User", roles: ["OPERATIONS"] },
    requestedAt: "2026-11-06T12:00:00.000Z",
    reason: "Amended delivery terms",
    evidenceId: null,
    correlationId: "approval-request-test",
    ...overrides,
  };
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code && (status === undefined || error.problem.status === status);
}

test("fixed matrix exposes exactly the 13 accepted action codes, requester roles, approver and subject types", async () => {
  const actions = await loadActionCodes();
  assert.deepEqual(actions.APPROVAL_ACTION_CODES, Object.keys(EXPECTED_MATRIX));
  assert.deepEqual(actions.FIXED_APPROVAL_MATRIX, EXPECTED_MATRIX);
  for (const rule of Object.values(actions.FIXED_APPROVAL_MATRIX)) {
    assert.equal(rule.approverRole, "OWNER_ADMIN");
    assert.ok(rule.requesterRoles.length > 0);
  }
});

test("requests bind the exact subject type, id, reference, version and lowercase SHA-256", async () => {
  const service = await loadApprovalService();
  const approval = service.createApprovalRequest(requestInput());
  assert.deepEqual(approval, {
    id: IDS.approval,
    actionCode: "CONTRACT_VERSION",
    subjectType: "CONTRACT_VERSION",
    subjectId: IDS.subject,
    subjectReference: "SC-001",
    subjectVersion: 3,
    subjectHash: HASH,
    requester: { userId: IDS.requester, displayName: "Operations User", roles: ["OPERATIONS"] },
    requestedAt: "2026-11-06T12:00:00.000Z",
    reason: "Amended delivery terms",
    evidenceId: null,
    decision: "PENDING",
    approverId: null,
    decidedAt: null,
    comment: null,
    expiredAt: null,
    version: 1,
  });
  assert.throws(() => service.createApprovalRequest(requestInput({
    subject: { type: "PROJECT", id: IDS.subject, reference: "SC-001", version: 3, hash: HASH },
  })), isProblem("VALIDATION_FAILED", 400));
  assert.throws(() => service.createApprovalRequest(requestInput({
    subject: { type: "CONTRACT_VERSION", id: IDS.subject, reference: "SC-001", version: 3, hash: "not-a-hash" },
  })), isProblem("VALIDATION_FAILED", 400));
});

test("requester role matrix is enforced, including Finance closure requests and no Owner-only bypass", async () => {
  const service = await loadApprovalService();
  assert.doesNotThrow(() => service.createApprovalRequest(requestInput()));
  assert.doesNotThrow(() => service.createApprovalRequest(requestInput({
    actionCode: "FINAL_CLOSE",
    subject: { type: "PROJECT", id: IDS.subject, reference: "PRJ-001", version: 8, hash: HASH },
    requester: { userId: IDS.requester, displayName: "Finance User", roles: ["FINANCE_VIEWER"] },
  })));
  for (const requester of [
    { userId: IDS.requester, displayName: "Finance User", roles: ["FINANCE_VIEWER"] },
    { userId: IDS.requester, displayName: "Owner Only", roles: ["OWNER_ADMIN"] },
  ]) assert.throws(() => service.createApprovalRequest(requestInput({ requester })), isProblem("PERMISSION_DENIED", 403));
});

test("decision requires a different Owner, current approval version and exact bound subject", async () => {
  const service = await loadApprovalService();
  const pending = service.createApprovalRequest(requestInput());
  const base = {
    approval: pending,
    approver: { userId: IDS.approver, roles: ["OWNER_ADMIN"] },
    expectedVersion: 1,
    currentSubject: { id: IDS.subject, version: 3, hash: HASH },
    decision: "APPROVED" as const,
    comment: "Reviewed exact amendment",
    decidedAt: "2026-11-06T12:05:00.000Z",
  };
  const approved = service.decideApproval(base);
  assert.deepEqual(approved, {
    ...pending,
    decision: "APPROVED",
    approverId: IDS.approver,
    decidedAt: base.decidedAt,
    comment: base.comment,
    version: 2,
  });
  assert.equal(pending.decision, "PENDING", "decision returns a new immutable snapshot");
  assert.throws(() => service.decideApproval({ ...base, approver: { userId: IDS.requester, roles: ["OWNER_ADMIN", "OPERATIONS"] } }), isProblem("SELF_APPROVAL_FORBIDDEN", 409));
  assert.throws(() => service.decideApproval({ ...base, approver: { userId: IDS.approver, roles: ["OPERATIONS"] } }), isProblem("PERMISSION_DENIED", 403));
  assert.throws(() => service.decideApproval({ ...base, expectedVersion: 2 }), isProblem("STALE_VERSION", 412));
  assert.throws(() => service.decideApproval({ ...base, currentSubject: { id: IDS.subject, version: 4, hash: "b".repeat(64) } }), isProblem("APPROVAL_VERSION_MISMATCH", 409));
  assert.throws(() => service.decideApproval({ ...base, approval: approved, expectedVersion: 2 }), isProblem("INVALID_STATE_TRANSITION", 409));
});

test("subject version or hash change expires pending applicability and cannot rewrite a terminal decision", async () => {
  const service = await loadApprovalService();
  const pending = service.createApprovalRequest(requestInput());
  assert.equal(service.expireIfSubjectChanged(pending, { id: IDS.subject, version: 3, hash: HASH }, "2026-11-06T12:06:00.000Z"), pending);
  const expired = service.expireIfSubjectChanged(pending, { id: IDS.subject, version: 4, hash: "b".repeat(64) }, "2026-11-06T12:06:00.000Z");
  assert.deepEqual(expired, { ...pending, decision: "EXPIRED", expiredAt: "2026-11-06T12:06:00.000Z", version: 2 });
  assert.equal(pending.decision, "PENDING");

  const approved = service.decideApproval({
    approval: pending, approver: { userId: IDS.approver, roles: ["OWNER_ADMIN"] }, expectedVersion: 1,
    currentSubject: { id: IDS.subject, version: 3, hash: HASH }, decision: "APPROVED", comment: "Approved",
    decidedAt: "2026-11-06T12:05:00.000Z",
  });
  assert.throws(() => service.expireIfSubjectChanged(approved, { id: IDS.subject, version: 4, hash: "b".repeat(64) }, "2026-11-06T12:06:00.000Z"), isProblem("INVALID_STATE_TRANSITION", 409));
});
