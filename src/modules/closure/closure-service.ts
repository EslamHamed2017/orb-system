import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assessmentSnapshot, buildClosureAssessment, type ClosureAssessment } from "./assessment-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invalidateClosureBasis } from "./invalidation.ts";

type Row = Record<string, unknown>;
interface Principal { readonly userId: string; readonly roles: readonly string[] }
interface Project { id: string; version: number; finalState: string; assessmentValid: boolean }
interface Approval { id: string; actionCode: "CLOSURE_EXCEPTION" | "FINAL_CLOSE" | "REOPEN"; subjectType: string; subjectId: string;
  subjectVersion: number; subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  approverId: string | null; version: number; blockerIds: string[]; reason: string }
interface Runtime { now: () => string; projects: Map<string, Project>; rows: Record<string, Row[]>; assessments: Map<string, ClosureAssessment>;
  approvals: Map<string, Approval>; idempotency: Map<string, unknown>; audit: Row[] }

const clone = <T>(value: T): T => structuredClone(value);
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
const frozen = <T>(value: T): T => deepFreeze(clone(value));
function fail(code: string, status: number, correlationId?: unknown): never {
  throw problemError({ code, status, correlationId: typeof correlationId === "string" && correlationId ? correlationId : randomUUID() });
}
function principal(input: Row, roles: readonly string[]): Principal {
  const value = input.principal as Principal | undefined;
  if (!value || typeof value.userId !== "string" || !Array.isArray(value.roles) || !value.roles.some((role) => roles.includes(role)))
    fail("PERMISSION_DENIED", 403, input.correlationId);
  return value;
}
function project(runtime: Runtime, id: unknown, correlationId?: unknown) {
  const value = typeof id === "string" ? runtime.projects.get(id) : undefined;
  if (!value) fail("RESOURCE_NOT_FOUND", 404, correlationId); return value;
}
function exactVersion(actual: number, expected: unknown, correlationId?: unknown) {
  if (!Number.isSafeInteger(expected) || expected !== actual) fail("STALE_VERSION", 412, correlationId);
}
function commandKey(runtime: Runtime, input: Row, operation: string, actor: Principal) {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length === 0) fail("VALIDATION_FAILED", 400, input.correlationId);
  return `${operation}:${actor.userId}:${input.idempotencyKey}`;
}
function result(runtime: Runtime, key: string, create: () => unknown) {
  if (runtime.idempotency.has(key)) return Promise.resolve({ value: frozen(runtime.idempotency.get(key)), replayed: true });
  const value = create(); runtime.idempotency.set(key, clone(value)); return Promise.resolve({ value: frozen(value), replayed: false });
}
function decimalMicros(value: unknown): bigint {
  const match = String(value ?? "0").match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/); if (!match) throw new TypeError("Invalid six-scale decimal");
  return (match[1] ? -1n : 1n) * (BigInt(match[2]) * 1_000_000n + BigInt((match[3] ?? "").padEnd(6, "0")));
}
function formatMicros(value: bigint) { const sign = value < 0n ? "-" : ""; const abs = value < 0n ? -value : value;
  return `${sign}${abs / 1_000_000n}.${String(abs % 1_000_000n).padStart(6, "0")}`; }
function approvalHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function audit(runtime: Runtime, action: string, aggregateId: string, actorId: string, reason?: string) {
  runtime.audit.push(Object.freeze({ action, aggregateId, actorId, occurredAt: runtime.now(), ...(reason ? { reason } : {}) }));
}
function createApproval(runtime: Runtime, actionCode: Approval["actionCode"], subjectType: string, subjectId: string, subjectVersion: number,
  subjectHash: string, requesterId: string, blockerIds: string[] = [], reason = "") {
  const approval: Approval = { id: randomUUID(), actionCode, subjectType, subjectId, subjectVersion, subjectHash, requesterId,
    decision: "PENDING", approverId: null, version: 1, blockerIds: [...blockerIds], reason };
  runtime.approvals.set(approval.id, approval); return approval;
}
function activeAssessment(runtime: Runtime, id: unknown, row: Project, correlationId?: unknown) {
  const value = typeof id === "string" ? runtime.assessments.get(id) : undefined;
  if (!value || value.projectId !== row.id || value.projectVersion !== row.version || value.state !== "CURRENT") fail("CLOSURE_BLOCKED", 409, correlationId);
  return value;
}
function snapshotApproval(value: Approval) { return frozen(value); }
function financial(runtime: Runtime, projectId: string) {
  const shipments = runtime.rows.salesShipments.filter((item) => item.projectId === projectId && item.executionState !== "CANCELLED").map((shipment) => {
    const documents = runtime.rows.documents.filter((item) => item.salesShipmentId === shipment.id && item.type === "CINV" && item.state === "APPROVED" && item.cancelled !== true);
    const outstanding = documents.reduce((total, doc) => total + runtime.rows.customerInvoiceBalances.filter((balance) => balance.documentId === doc.id)
      .reduce((sum, balance) => sum + decimalMicros(balance.outstanding), 0n), 0n);
    const state = documents.length > 0 && outstanding === 0n ? "FINANCIALLY_CLOSED" as const : "OPEN" as const;
    return { shipmentId: String(shipment.id), state, approvedCinvCount: documents.length, customerOutstanding: formatMicros(outstanding) };
  });
  return { projectId, state: shipments.every((item) => item.state === "FINANCIALLY_CLOSED") ? "FINANCIALLY_CLOSED" as const : "OPEN" as const, shipments };
}
function createRuntime(options: Row): Runtime {
  const names = ["salesShipments", "supplierShipments", "supplierInvoices", "routeItems", "documents", "customerInvoiceBalances", "expenses", "claims", "approvals", "integrityFindings", "securityFindings"];
  const rows = Object.fromEntries(names.map((name) => [name, clone((options[name] as Row[] | undefined) ?? [])]));
  const projects = new Map(((options.projects as Row[] | undefined) ?? []).map((item) => [String(item.id), { id: String(item.id), version: Number(item.version),
    finalState: item.state === "FINAL_CLOSED" || item.finalState === "FINAL_CLOSED" ? "FINAL_CLOSED" : "OPEN", assessmentValid: item.assessmentValid === true }]));
  return { now: typeof options.now === "function" ? options.now as () => string : () => new Date().toISOString(), projects, rows,
    assessments: new Map(), approvals: new Map(), idempotency: new Map(), audit: [] };
}

export function createInMemoryClosureService(options: Row) {
  const runtime = createRuntime(options);
  return {
    async financialState(projectId: string) { project(runtime, projectId); return frozen(financial(runtime, projectId)); },
    async assess(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN", "OPERATIONS"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "assessProjectClosure", actor);
      return result(runtime, key, () => {
        const value = buildClosureAssessment({ project: row, salesShipments: runtime.rows.salesShipments,
          supplierShipments: runtime.rows.supplierShipments, supplierInvoices: runtime.rows.supplierInvoices, routeItems: runtime.rows.routeItems,
          documents: runtime.rows.documents, customerInvoiceBalances: runtime.rows.customerInvoiceBalances, expenses: runtime.rows.expenses,
          claims: runtime.rows.claims, approvals: runtime.rows.approvals, integrityFindings: runtime.rows.integrityFindings,
          securityFindings: runtime.rows.securityFindings, shipmentFinancialState: (id) => financial(runtime, row.id).shipments.find((item) => item.shipmentId === id)?.state ?? "OPEN" }, runtime.now());
        runtime.assessments.set(value.id, value); row.assessmentValid = true; audit(runtime, "CLOSURE_ASSESSED", row.id, actor.userId); return assessmentSnapshot(value);
      });
    },
    async requestException(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "requestClosureException", actor);
      return result(runtime, key, () => {
        const assessment = activeAssessment(runtime, input.assessmentId, row, input.correlationId);
        const blockerIds = Array.isArray(input.blockerIds) ? input.blockerIds.filter((id): id is string => typeof id === "string") : [];
        const selected = assessment.blockers.filter((item) => blockerIds.includes(item.id));
        if (selected.length === 0 || selected.length !== blockerIds.length || selected.some((item) => !item.exceptionEligible || item.coveredByApprovalId)
          || typeof input.reason !== "string" || input.reason.trim().length < 3) fail("CLOSURE_BLOCKED", 409, input.correlationId);
        const subject = { assessmentId: assessment.id, projectVersion: row.version, blockerIds: [...blockerIds].sort(), reason: input.reason.trim() };
        return snapshotApproval(createApproval(runtime, "CLOSURE_EXCEPTION", "CLOSURE_ASSESSMENT", assessment.id, row.version,
          approvalHash(subject), actor.userId, blockerIds, input.reason.trim()));
      });
    },
    async submitFinalClose(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "submitFinalCloseForApproval", actor);
      return result(runtime, key, () => {
        const assessment = activeAssessment(runtime, input.assessmentId, row, input.correlationId);
        if (assessment.blockers.some((item) => item.coveredByApprovalId === null)) fail("CLOSURE_BLOCKED", 409, input.correlationId);
        return snapshotApproval(createApproval(runtime, "FINAL_CLOSE", "CLOSURE_ASSESSMENT", assessment.id, row.version,
          approvalHash({ assessmentId: assessment.id, projectVersion: row.version, blockersHash: assessment.blockersHash }), actor.userId));
      });
    },
    async submitReopen(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "submitReopenForApproval", actor);
      return result(runtime, key, () => { if (row.finalState !== "FINAL_CLOSED" || typeof input.reason !== "string" || input.reason.trim().length < 3) fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
        return snapshotApproval(createApproval(runtime, "REOPEN", "PROJECT", row.id, row.version,
          approvalHash({ projectId: row.id, projectVersion: row.version, reason: input.reason.trim() }), actor.userId, [], input.reason.trim())); });
    },
    async decideApproval(input: Row) {
      const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404, input.correlationId); const actor = input.approver as Principal | undefined;
      if (actor?.userId === approval.requesterId) fail("SELF_APPROVAL_FORBIDDEN", 409, input.correlationId);
      if (!actor?.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, input.correlationId);
      exactVersion(approval.version, input.expectedVersion, input.correlationId);
      if (approval.decision !== "PENDING" || !new Set(["APPROVED", "REJECTED"]).has(String(input.decision))) fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
      approval.decision = input.decision as "APPROVED" | "REJECTED"; approval.approverId = actor.userId; approval.version += 1;
      if (approval.decision === "APPROVED" && approval.actionCode === "CLOSURE_EXCEPTION") {
        const assessment = runtime.assessments.get(approval.subjectId); if (!assessment || assessment.state !== "CURRENT" || assessment.projectVersion !== approval.subjectVersion) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        for (const blocker of assessment.blockers) if (approval.blockerIds.includes(blocker.id)) blocker.coveredByApprovalId = approval.id;
      }
      return snapshotApproval(approval);
    },
    async finalClose(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "finalCloseProject", actor);
      return result(runtime, key, () => {
        const assessment = activeAssessment(runtime, input.assessmentId, row, input.correlationId);
        const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
        if (!approval || approval.actionCode !== "FINAL_CLOSE" || approval.subjectId !== assessment.id || approval.subjectVersion !== row.version) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", 409, input.correlationId);
        if (assessment.blockers.some((item) => item.coveredByApprovalId === null)) fail("CLOSURE_BLOCKED", 409, input.correlationId);
        row.finalState = "FINAL_CLOSED"; row.assessmentValid = true; row.version += 1; audit(runtime, "PROJECT_FINAL_CLOSED", row.id, actor.userId); return row;
      });
    },
    async reopen(input: Row) {
      const actor = principal(input, ["OWNER_ADMIN"]); const row = project(runtime, input.projectId, input.correlationId);
      exactVersion(row.version, input.expectedVersion, input.correlationId); const key = commandKey(runtime, input, "reopenProject", actor);
      return result(runtime, key, () => { const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
        if (!approval || approval.actionCode !== "REOPEN" || approval.subjectId !== row.id || approval.subjectVersion !== row.version) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", 409, input.correlationId);
        if (typeof input.reason !== "string" || input.reason.trim() !== approval.reason) fail("APPROVAL_VERSION_MISMATCH", 409, input.correlationId);
        row.finalState = "OPEN"; row.assessmentValid = false; row.version += 1; audit(runtime, "PROJECT_REOPENED", row.id, actor.userId, input.reason.trim()); return { ...row, financialState: financial(runtime, row.id).state }; });
    },
    async invalidate(input: Row) { const row = project(runtime, input.projectId, input.correlationId); invalidateClosureBasis({ project: row,
      assessments: [...runtime.assessments.values()].filter((item) => item.projectId === row.id), kind: input.kind });
      for (const approval of runtime.approvals.values()) if (approval.subjectId === row.id || runtime.assessments.get(approval.subjectId)?.projectId === row.id) if (approval.decision === "PENDING") { approval.decision = "EXPIRED"; approval.version += 1; }
      audit(runtime, "CLOSURE_BASIS_INVALIDATED", row.id, "SYSTEM", String(input.reason ?? input.kind)); return frozen(row); },
    async assessment(id: string) { const value = runtime.assessments.get(id); if (!value) fail("RESOURCE_NOT_FOUND", 404); return assessmentSnapshot(value); },
    async project(id: string) { return frozen(project(runtime, id)); },
    async auditTrail() { return Object.freeze(runtime.audit.map(frozen)); },
  };
}
