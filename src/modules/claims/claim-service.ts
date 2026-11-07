import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimOutcomeArtifacts, projectClaimClosure } from "./claim-query.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimOutcomeHash, outcomeSubject, type ClaimOutcomeProposal } from "./outcome-service.ts";

const CLAIM_TYPES = new Set(["QUANTITY", "WEIGHT", "QUALITY", "DELIVERY", "PRICE", "DOCUMENT"]);
const OUTCOMES = new Set(["RESOLVED", "REJECTED"]);
type ClaimState = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
interface Principal { readonly userId: string; readonly displayName?: string; readonly roles: readonly string[] }
interface Project { id: string; version: number; finalState: string; assessmentValid: boolean }
interface Claim {
  id: string; projectId: string; salesShipmentId: string | null; supplierShipmentId: string | null; type: string;
  claimantId: string; respondentId: string; description: string; quantity: string | null; amount: string | null;
  currency: string | null; evidenceId: string | null; state: ClaimState; version: number;
}
interface Approval {
  id: string; actionCode: "CLAIM_OUTCOME"; subjectType: "CLAIM_OUTCOME_PROPOSAL"; subjectId: string;
  subjectVersion: number; subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  approverId: string | null; version: number;
}
interface Runtime {
  now: () => string; projects: Map<string, Project>; salesShipments: Map<string, string>; supplierShipments: Map<string, string>;
  parties: Set<string>; evidence: Map<string, { projectId: string; state: string }>; claims: Map<string, Claim>;
  proposals: Map<string, ClaimOutcomeProposal>; approvals: Map<string, Approval>; idempotency: Map<string, unknown>;
  audit: Array<Record<string, unknown>>;
}

const clone = <T>(value: T): T => structuredClone(value);
const frozen = <T>(value: T): T => Object.freeze(clone(value));
function fail(code: string, status: number, correlationId?: unknown): never {
  throw problemError({ code, status, correlationId: typeof correlationId === "string" && correlationId ? correlationId : randomUUID() });
}
function actor(input: Record<string, unknown>): Principal {
  const principal = input.principal as Principal | undefined;
  if (!principal || typeof principal.userId !== "string" || !Array.isArray(principal.roles)
    || !principal.roles.some((role) => role === "OPERATIONS" || role === "OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, input.correlationId);
  return principal;
}
function idempotencyKey(runtime: Runtime, input: Record<string, unknown>, operation: string, principal: Principal) {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length === 0) fail("VALIDATION_FAILED", 400, input.correlationId);
  return `${operation}:${principal.userId}:${input.idempotencyKey}`;
}
function result(runtime: Runtime, key: string, create: () => unknown) {
  if (runtime.idempotency.has(key)) return Promise.resolve({ value: frozen(runtime.idempotency.get(key)), replayed: true });
  const value = create(); runtime.idempotency.set(key, clone(value)); return Promise.resolve({ value: frozen(value), replayed: false });
}
function claim(runtime: Runtime, id: unknown, correlationId?: unknown) {
  const value = typeof id === "string" ? runtime.claims.get(id) : undefined;
  if (!value) fail("RESOURCE_NOT_FOUND", 404, correlationId); return value;
}
function exactVersion(actual: number, expected: unknown, correlationId?: unknown) {
  if (!Number.isSafeInteger(expected) || expected !== actual) fail("STALE_VERSION", 412, correlationId);
}
function nonempty(value: unknown, minimum = 1) { return typeof value === "string" && value.trim().length >= minimum; }
function optionalDecimal(value: unknown) { return value === undefined || value === null || typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value); }
function audit(runtime: Runtime, action: string, aggregateId: string, principalId: string) {
  runtime.audit.push(Object.freeze({ action, aggregateId, actorId: principalId, occurredAt: runtime.now() }));
}

function createRuntime(options: Record<string, unknown>): Runtime {
  const rows = (name: string) => (options[name] as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    now: typeof options.now === "function" ? options.now as () => string : () => new Date().toISOString(),
    projects: new Map(rows("projects").map((item) => [String(item.id), { id: String(item.id), version: Number(item.version), finalState: String(item.finalState ?? "OPEN"), assessmentValid: item.assessmentValid === true }])),
    salesShipments: new Map(rows("salesShipments").map((item) => [String(item.id), String(item.projectId)])),
    supplierShipments: new Map(rows("supplierShipments").map((item) => [String(item.id), String(item.projectId)])),
    parties: new Set(rows("parties").map((item) => String(item.id))),
    evidence: new Map(rows("evidence").map((item) => [String(item.id), { projectId: String(item.projectId), state: String(item.state) }])),
    claims: new Map(), proposals: new Map(), approvals: new Map(), idempotency: new Map(), audit: [],
  };
}

export function createInMemoryClaimService(options: Record<string, unknown>) {
  const runtime = createRuntime(options);
  return {
    async open(input: Record<string, unknown>) {
      const principal = actor(input); const key = idempotencyKey(runtime, input, "openSimpleClaim", principal);
      return result(runtime, key, () => {
        const project = typeof input.projectId === "string" ? runtime.projects.get(input.projectId) : undefined;
        if (!project) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
        const salesShipmentId = typeof input.salesShipmentId === "string" ? input.salesShipmentId : null;
        const supplierShipmentId = typeof input.supplierShipmentId === "string" ? input.supplierShipmentId : null;
        const evidenceId = typeof input.evidenceId === "string" ? input.evidenceId : null;
        const evidence = evidenceId ? runtime.evidence.get(evidenceId) : null;
        const valid = CLAIM_TYPES.has(String(input.type)) && runtime.parties.has(String(input.claimantId))
          && runtime.parties.has(String(input.respondentId)) && input.claimantId !== input.respondentId
          && nonempty(input.description, 3) && optionalDecimal(input.quantity) && optionalDecimal(input.amount)
          && (input.currency === undefined || input.currency === null || typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency))
          && (salesShipmentId !== null || supplierShipmentId !== null)
          && (salesShipmentId === null || runtime.salesShipments.get(salesShipmentId) === project.id)
          && (supplierShipmentId === null || runtime.supplierShipments.get(supplierShipmentId) === project.id)
          && (evidenceId === null || evidence?.projectId === project.id && evidence.state === "AVAILABLE");
        if (!valid) fail("VALIDATION_FAILED", 400, input.correlationId);
        exactVersion(project.version, input.expectedVersion, input.correlationId);
        const row: Claim = { id: randomUUID(), projectId: project.id, salesShipmentId, supplierShipmentId, type: String(input.type),
          claimantId: String(input.claimantId), respondentId: String(input.respondentId), description: String(input.description).trim(),
          quantity: input.quantity == null ? null : String(input.quantity), amount: input.amount == null ? null : String(input.amount),
          currency: input.currency == null ? null : String(input.currency), evidenceId, state: "OPEN", version: 1 };
        runtime.claims.set(row.id, row); project.finalState = "OPEN"; project.assessmentValid = false;
        audit(runtime, "CLAIM_OPENED", row.id, principal.userId); return row;
      });
    },
    async transition(input: Record<string, unknown>) {
      const principal = actor(input); const key = idempotencyKey(runtime, input, "moveClaimUnderReview", principal);
      return result(runtime, key, () => {
        const row = claim(runtime, input.claimId, input.correlationId); exactVersion(row.version, input.expectedVersion, input.correlationId);
        if (row.state !== "OPEN" || input.toState !== "UNDER_REVIEW") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
        if (!nonempty(input.reason, 3)) fail("VALIDATION_FAILED", 400, input.correlationId);
        row.state = "UNDER_REVIEW"; row.version += 1; audit(runtime, "CLAIM_UNDER_REVIEW", row.id, principal.userId); return row;
      });
    },
    async submitOutcome(input: Record<string, unknown>) {
      const principal = actor(input); const key = idempotencyKey(runtime, input, "submitClaimOutcomeForApproval", principal);
      return result(runtime, key, () => {
        const row = claim(runtime, input.claimId, input.correlationId); exactVersion(row.version, input.expectedVersion, input.correlationId);
        if (row.state !== "UNDER_REVIEW") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
        if (!OUTCOMES.has(String(input.outcome)) || !nonempty(input.reason, 3)) fail("VALIDATION_FAILED", 400, input.correlationId);
        const evidenceId = typeof input.evidenceId === "string" ? input.evidenceId : null;
        const evidence = evidenceId ? runtime.evidence.get(evidenceId) : null;
        if (evidenceId && (!evidence || evidence.projectId !== row.projectId || evidence.state !== "AVAILABLE")) fail("VALIDATION_FAILED", 400, input.correlationId);
        const id = randomUUID();
        const subject = outcomeSubject({ claimId: row.id, claimVersion: row.version, proposedOutcome: input.outcome as "RESOLVED" | "REJECTED", reason: String(input.reason).trim(), evidenceId });
        const proposal: ClaimOutcomeProposal = { id, ...subject, subjectHash: claimOutcomeHash(subject), state: "PENDING_APPROVAL" };
        const approval: Approval = { id: randomUUID(), actionCode: "CLAIM_OUTCOME", subjectType: "CLAIM_OUTCOME_PROPOSAL", subjectId: id,
          subjectVersion: row.version, subjectHash: proposal.subjectHash, requesterId: principal.userId, decision: "PENDING", approverId: null, version: 1 };
        runtime.proposals.set(id, proposal); runtime.approvals.set(approval.id, approval);
        audit(runtime, "CLAIM_OUTCOME_SUBMITTED", row.id, principal.userId); return approval;
      });
    },
    async decideApproval(input: Record<string, unknown>) {
      const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      const approver = input.approver as Principal | undefined;
      if (approver?.userId === approval.requesterId) fail("SELF_APPROVAL_FORBIDDEN", 409, input.correlationId);
      if (!approver?.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, input.correlationId);
      if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
      exactVersion(approval.version, input.expectedVersion, input.correlationId);
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED" || !nonempty(input.comment)) fail("VALIDATION_FAILED", 400, input.correlationId);
      const proposal = runtime.proposals.get(approval.subjectId)!;
      const row = claim(runtime, proposal.claimId, input.correlationId);
      const subject = outcomeSubject(proposal);
      if (row.version !== proposal.claimVersion || claimOutcomeHash(subject) !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
      approval.decision = input.decision; approval.approverId = approver.userId; approval.version += 1;
      proposal.state = input.decision === "APPROVED" ? "APPROVED" : "REJECTED";
      audit(runtime, `CLAIM_OUTCOME_${input.decision}`, row.id, approver.userId); return frozen(approval);
    },
    async expireApproval(input: Record<string, unknown>) {
      const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
      approval.decision = "EXPIRED"; approval.version += 1; runtime.proposals.get(approval.subjectId)!.state = "EXPIRED"; return frozen(approval);
    },
    async applyOutcome(input: Record<string, unknown>) {
      const principal = actor(input); const key = idempotencyKey(runtime, input, "applyApprovedClaimOutcome", principal);
      return result(runtime, key, () => {
        const row = claim(runtime, input.claimId, input.correlationId); exactVersion(row.version, input.expectedVersion, input.correlationId);
        if (row.state !== "UNDER_REVIEW") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
        const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
        if (!approval || approval.actionCode !== "CLAIM_OUTCOME") fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", 409, input.correlationId);
        const proposal = runtime.proposals.get(approval.subjectId);
        if (!proposal || proposal.claimId !== row.id || proposal.claimVersion !== row.version || proposal.subjectHash !== approval.subjectHash
          || claimOutcomeHash(outcomeSubject(proposal)) !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        row.state = proposal.proposedOutcome; row.version += 1; proposal.state = "APPLIED";
        audit(runtime, "CLAIM_OUTCOME_APPLIED", row.id, principal.userId); return row;
      });
    },
    async get(claimId: string) { return frozen(claim(runtime, claimId)); },
    async getProposal(proposalId: string) { const value = runtime.proposals.get(proposalId); if (!value) fail("RESOURCE_NOT_FOUND", 404); return frozen(value); },
    async closure(projectId: string) { if (!runtime.projects.has(projectId)) fail("RESOURCE_NOT_FOUND", 404); return projectClaimClosure([...runtime.claims.values()], projectId); },
    async outcomeArtifacts(claimId: string) { claim(runtime, claimId); return claimOutcomeArtifacts(); },
    async auditTrail() { return Object.freeze(runtime.audit.map(frozen)); },
  };
}
