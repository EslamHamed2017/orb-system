import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { FIXED_APPROVAL_MATRIX, isApprovalActionCode, type ApprovalActionCode } from "./action-codes.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const TERMINAL_STATES = new Set(["APPROVED", "REJECTED", "EXPIRED"]);

export interface ApprovalActor {
  readonly userId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}
export interface ApprovalSnapshot {
  readonly id: string;
  readonly actionCode: ApprovalActionCode;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly subjectReference: string;
  readonly subjectVersion: number;
  readonly subjectHash: string;
  readonly requester: ApprovalActor;
  readonly requestedAt: string;
  readonly reason: string;
  readonly evidenceId: string | null;
  readonly decision: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  readonly approverId: string | null;
  readonly decidedAt: string | null;
  readonly comment: string | null;
  readonly expiredAt: string | null;
  readonly version: number;
}

function fail(code: string, status: number, correlationId?: string): never {
  throw problemError({ code, status, correlationId: correlationId?.trim() || randomUUID() });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}
function freezeActor(actor: ApprovalActor): ApprovalActor {
  return Object.freeze({ userId: actor.userId, displayName: actor.displayName, roles: Object.freeze([...actor.roles]) });
}
function freezeApproval(approval: ApprovalSnapshot): ApprovalSnapshot {
  return Object.freeze({ ...approval, requester: freezeActor(approval.requester) });
}

export function createApprovalRequest(input: Record<string, unknown>): ApprovalSnapshot {
  const correlationId = typeof input.correlationId === "string" ? input.correlationId : undefined;
  const subject = input.subject;
  const requester = input.requester;
  if (!isApprovalActionCode(input.actionCode) || !isRecord(subject) || !isRecord(requester)) fail("VALIDATION_FAILED", 400, correlationId);
  const actionCode = input.actionCode;
  const fixedRule = FIXED_APPROVAL_MATRIX[actionCode];
  const requesterRoles = requester.roles;
  const valid = UUID.test(String(input.id ?? ""))
    && subject.type === fixedRule.subjectType
    && UUID.test(String(subject.id ?? ""))
    && typeof subject.reference === "string" && subject.reference.trim().length > 0
    && Number.isSafeInteger(subject.version) && Number(subject.version) >= 1
    && typeof subject.hash === "string" && SHA256.test(subject.hash)
    && UUID.test(String(requester.userId ?? ""))
    && typeof requester.displayName === "string" && requester.displayName.trim().length > 0
    && Array.isArray(requesterRoles) && requesterRoles.every((role) => typeof role === "string")
    && isTimestamp(input.requestedAt)
    && typeof input.reason === "string" && input.reason.trim().length > 0
    && (input.evidenceId === null || (typeof input.evidenceId === "string" && UUID.test(input.evidenceId)));
  if (!valid) fail("VALIDATION_FAILED", 400, correlationId);
  if (!(requesterRoles as string[]).some((role) => fixedRule.requesterRoles.includes(role))) fail("PERMISSION_DENIED", 403, correlationId);

  return freezeApproval({
    id: input.id as string,
    actionCode,
    subjectType: subject.type as string,
    subjectId: subject.id as string,
    subjectReference: subject.reference as string,
    subjectVersion: subject.version as number,
    subjectHash: subject.hash as string,
    requester: { userId: requester.userId as string, displayName: requester.displayName as string, roles: requesterRoles as string[] },
    requestedAt: input.requestedAt as string,
    reason: input.reason as string,
    evidenceId: input.evidenceId as string | null,
    decision: "PENDING", approverId: null, decidedAt: null, comment: null, expiredAt: null, version: 1,
  });
}

export function decideApproval(input: {
  approval: Readonly<Record<string, unknown>>;
  approver: { readonly userId: string; readonly roles: readonly string[] };
  expectedVersion: number;
  currentSubject: { readonly id: string; readonly version: number; readonly hash: string };
  decision: "APPROVED" | "REJECTED";
  comment: string;
  decidedAt: string;
  correlationId?: string;
}): ApprovalSnapshot {
  const approval = input.approval as unknown as ApprovalSnapshot;
  if (approval.decision !== "PENDING" || TERMINAL_STATES.has(String(approval.decision))) fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
  if (!input.approver.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, input.correlationId);
  if (input.approver.userId === approval.requester.userId) fail("SELF_APPROVAL_FORBIDDEN", 409, input.correlationId);
  if (input.expectedVersion !== approval.version) fail("STALE_VERSION", 412, input.correlationId);
  if (input.currentSubject.id !== approval.subjectId || input.currentSubject.version !== approval.subjectVersion || input.currentSubject.hash !== approval.subjectHash) {
    fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
  }
  if (!UUID.test(input.approver.userId) || !["APPROVED", "REJECTED"].includes(input.decision)
      || typeof input.comment !== "string" || input.comment.trim().length === 0 || !isTimestamp(input.decidedAt)) {
    fail("VALIDATION_FAILED", 400, input.correlationId);
  }
  return freezeApproval({ ...approval, decision: input.decision, approverId: input.approver.userId,
    decidedAt: input.decidedAt, comment: input.comment, version: approval.version + 1 });
}

export function expireIfSubjectChanged(
  approvalInput: Readonly<Record<string, unknown>>,
  currentSubject: { readonly id: string; readonly version: number; readonly hash: string },
  expiredAt: string,
): ApprovalSnapshot {
  const approval = approvalInput as unknown as ApprovalSnapshot;
  const unchanged = currentSubject.id === approval.subjectId && currentSubject.version === approval.subjectVersion && currentSubject.hash === approval.subjectHash;
  if (unchanged) return approval;
  if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409);
  if (!isTimestamp(expiredAt)) fail("VALIDATION_FAILED", 400);
  return freezeApproval({ ...approval, decision: "EXPIRED", expiredAt, version: approval.version + 1 });
}
