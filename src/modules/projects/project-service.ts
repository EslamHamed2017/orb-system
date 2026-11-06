import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { executeIdempotently, type IdempotencyStore } from "../../platform/idempotency/store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { validateAmendment, validateContractInput, type ContractInput } from "../contracts/schemas.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { listProjectedProjects, type ProjectPrincipal } from "./project-query.ts";

type Principal = ProjectPrincipal & Readonly<{ displayName?: string }>;
type Command = Readonly<{ principal: Principal; idempotencyKey: string; correlationId: string }>;
type VersionState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";
interface ContractVersion extends Readonly<Record<string, unknown>> { id: string; contractId: string; revisionNo: number; state: VersionState; hash: string }
interface ContractRecord extends Readonly<Record<string, unknown>> { id: string; projectId: string; kind: "SALES" | "PURCHASE"; reference: string; version: number; activeVersionId: string }
interface ProjectRecord extends Readonly<Record<string, unknown>> { id: string; reference: string; customerId: string; primarySalesContractId: string; lifecycleState: "DRAFT" | "ACTIVE" | "CANCELLED"; financialState: "OPEN"; finalState: "OPEN"; managementCurrency: string; version: number }
interface ApprovalRecord extends Readonly<Record<string, unknown>> { id: string; subjectId: string; subjectVersion: number; subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED" }

export interface ProjectContractService {
  createProject(input: Command & { customerId: string; salesContract: ContractInput }): Promise<{ value: unknown; replayed: boolean }>;
  listProjects(input: { principal: Principal }): Promise<readonly unknown[]>;
  getProject(input: { projectId: string; principal: Principal }): Promise<unknown>;
  createPurchaseContract(input: Command & { projectId: string; expectedVersion: number; contract: ContractInput }): Promise<{ value: unknown; replayed: boolean }>;
  amendContract(input: Command & { contractId: string; expectedVersion: number; contract: ContractInput; reason: string; effectiveDate: string }): Promise<{ value: unknown; replayed: boolean }>;
  submitContract(input: Command & { contractId: string; expectedVersion: number }): Promise<{ value: unknown; replayed: boolean }>;
  applyContractDecision(input: { approvalId: string; approver: Principal; decision: "APPROVED" | "REJECTED"; comment: string }): Promise<unknown>;
  cancelProject(input: Command & { projectId: string; expectedVersion: number; reason: string }): Promise<{ value: unknown; replayed: boolean }>;
}

interface State { projects: Map<string, ProjectRecord>; contracts: Map<string, ContractRecord>; versions: Map<string, ContractVersion>; approvals: Map<string, ApprovalRecord>; audit: Readonly<Record<string, unknown>>[]; references: Set<string> }
const internals = new WeakMap<ProjectContractService, State>();
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function authorize(principal: Principal, mutation: boolean, correlationId: string): void {
  const allowed = mutation ? ["OWNER_ADMIN", "OPERATIONS"] : ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
  if (!principal.roles.some((role) => allowed.includes(role))) throw problemError({ code: "PERMISSION_DENIED", status: 403, correlationId });
}
function requireVersion(actual: number, expected: number, correlationId: string): void {
  if (actual !== expected) throw problemError({ code: "STALE_VERSION", status: 412, correlationId, extensions: { currentVersion: actual } });
}

export function createInMemoryProjectContractService(options: {
  idempotencyStore: IdempotencyStore; now: () => string; referenceSequence?: () => string;
  failSalesContractInsert?: () => boolean; hasExecution?: (projectId: string) => boolean;
}): ProjectContractService {
  const state: State = { projects: new Map(), contracts: new Map(), versions: new Map(), approvals: new Map(), audit: [], references: new Set() };
  let sequence = 0;
  const nextReference = () => options.referenceSequence?.() ?? `ORB-${new Date(options.now()).getUTCFullYear()}-${String(++sequence).padStart(4, "0")}`;
  const versionsOf = (contractId: string) => [...state.versions.values()].filter((row) => row.contractId === contractId).sort((a, b) => a.revisionNo - b.revisionNo);
  const exposeContract = (contract: ContractRecord) => Object.freeze({ ...clone(contract), activeVersion: clone(state.versions.get(contract.activeVersionId)!), versions: versionsOf(contract.id).map(clone) });
  const exposeProject = (project: ProjectRecord) => Object.freeze({ ...clone(project), salesContract: exposeContract(state.contracts.get(project.primarySalesContractId)!), contracts: [...state.contracts.values()].filter((row) => row.projectId === project.id).map(exposeContract) });
  const audit = (action: string, actorId: string, aggregateId: string, aggregateVersion: number, correlationId: string) => state.audit.push(Object.freeze({ id: randomUUID(), action, actorId, aggregateId, aggregateVersion, occurredAt: options.now(), correlationId }));
  const makeVersion = (contractId: string, revisionNo: number, facts: ContractInput, stateValue: VersionState, amendmentReason: string | null, effectiveDate: string | null): ContractVersion => {
    const validated = validateContractInput(facts, "contract-version");
    const base = { id: randomUUID(), contractId, revisionNo, effectiveDate, amendmentReason, ...validated, state: stateValue, approvalId: null };
    return Object.freeze({ ...base, hash: digest(base) });
  };
  const service: ProjectContractService = {
    async createProject(command) {
      authorize(command.principal, true, command.correlationId);
      return executeIdempotently(options.idempotencyStore, { actorId: command.principal.userId, operationId: "createProjectWithSalesContract", key: command.idempotencyKey, request: { customerId: command.customerId, salesContract: command.salesContract }, correlationId: command.correlationId }, async () => {
        const facts = validateContractInput(command.salesContract, command.correlationId);
        const reference = nextReference();
        if (state.references.has(reference)) throw problemError({ code: "DUPLICATE_REFERENCE", status: 409, correlationId: command.correlationId });
        if (options.failSalesContractInsert?.()) throw new Error("Atomic sales contract insert failed");
        const projectId = randomUUID(), contractId = randomUUID();
        const version = makeVersion(contractId, 1, facts, "DRAFT", null, null);
        const contract: ContractRecord = Object.freeze({ id: contractId, projectId, kind: "SALES", reference: `${reference}-S`, counterpartyId: facts.counterpartyId, activeVersionId: version.id, state: "DRAFT", version: 1 });
        const project: ProjectRecord = Object.freeze({ id: projectId, reference, customerId: command.customerId, primarySalesContractId: contractId, lifecycleState: "DRAFT", financialState: "OPEN", finalState: "OPEN", managementCurrency: facts.currency, version: 1 });
        state.references.add(reference); state.versions.set(version.id, version); state.contracts.set(contract.id, contract); state.projects.set(project.id, project);
        audit("PROJECT_CREATED", command.principal.userId, project.id, 1, command.correlationId); audit("CONTRACT_VERSION_CREATED", command.principal.userId, contract.id, 1, command.correlationId);
        return { status: 201, value: exposeProject(project) };
      }).then(({ value, replayed }) => ({ value, replayed }));
    },
    async listProjects({ principal }) { authorize(principal, false, "list-projects"); return listProjectedProjects([...state.projects.values()].map((row) => exposeProject(row) as ProjectRecord)); },
    async getProject({ projectId, principal }) { authorize(principal, false, "get-project"); const project = state.projects.get(projectId); if (!project) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: "get-project" }); return exposeProject(project); },
    async createPurchaseContract(command) {
      authorize(command.principal, true, command.correlationId);
      return executeIdempotently(options.idempotencyStore, { actorId: command.principal.userId, operationId: "createPurchaseContract", key: command.idempotencyKey, request: { projectId: command.projectId, expectedVersion: command.expectedVersion, contract: command.contract }, correlationId: command.correlationId }, async () => {
        const project = state.projects.get(command.projectId); if (!project) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.correlationId }); requireVersion(project.version, command.expectedVersion, command.correlationId);
        if (project.lifecycleState === "CANCELLED") throw problemError({ code: "INVALID_STATE_TRANSITION", status: 409, correlationId: command.correlationId });
        const facts = validateContractInput(command.contract, command.correlationId), id = randomUUID(), revision = makeVersion(id, 1, facts, "DRAFT", null, null);
        const count = [...state.contracts.values()].filter((row) => row.projectId === project.id && row.kind === "PURCHASE").length + 1;
        const contract: ContractRecord = Object.freeze({ id, projectId: project.id, kind: "PURCHASE", reference: `${project.reference}-P${count}`, counterpartyId: facts.counterpartyId, activeVersionId: revision.id, state: "DRAFT", version: 1 });
        state.versions.set(revision.id, revision); state.contracts.set(contract.id, contract); audit("CONTRACT_VERSION_CREATED", command.principal.userId, contract.id, 1, command.correlationId);
        return { status: 201, value: exposeContract(contract) };
      }).then(({ value, replayed }) => ({ value, replayed }));
    },
    async amendContract(command) {
      authorize(command.principal, true, command.correlationId); validateAmendment(command.reason, command.effectiveDate, command.correlationId);
      return executeIdempotently(options.idempotencyStore, { actorId: command.principal.userId, operationId: "createContractAmendment", key: command.idempotencyKey, request: { contractId: command.contractId, expectedVersion: command.expectedVersion, contract: command.contract, reason: command.reason, effectiveDate: command.effectiveDate }, correlationId: command.correlationId }, async () => {
        const current = state.contracts.get(command.contractId); if (!current) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.correlationId }); requireVersion(current.version, command.expectedVersion, command.correlationId);
        const active = state.versions.get(current.activeVersionId)!;
        if (active.state === "PENDING_APPROVAL") throw problemError({ code: "INVALID_STATE_TRANSITION", status: 409, correlationId: command.correlationId });
        if (active.state === "DRAFT" || active.state === "REJECTED") state.versions.set(active.id, Object.freeze({ ...active, state: "SUPERSEDED" }));
        const revision = makeVersion(current.id, Math.max(...versionsOf(current.id).map((row) => row.revisionNo)) + 1, command.contract, "DRAFT", command.reason, command.effectiveDate);
        const next = Object.freeze({ ...current, activeVersionId: revision.id, state: "DRAFT", version: current.version + 1 }); state.versions.set(revision.id, revision); state.contracts.set(next.id, next);
        audit("CONTRACT_AMENDED", command.principal.userId, next.id, next.version, command.correlationId); return { status: 201, value: exposeContract(next) };
      }).then(({ value, replayed }) => ({ value, replayed }));
    },
    async submitContract(command) {
      authorize(command.principal, true, command.correlationId);
      return executeIdempotently(options.idempotencyStore, { actorId: command.principal.userId, operationId: "submitContractForApproval", key: command.idempotencyKey, request: { contractId: command.contractId, expectedVersion: command.expectedVersion }, correlationId: command.correlationId }, async () => {
        const contract = state.contracts.get(command.contractId); if (!contract) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.correlationId }); requireVersion(contract.version, command.expectedVersion, command.correlationId);
        const active = state.versions.get(contract.activeVersionId)!; if (active.state !== "DRAFT") throw problemError({ code: "INVALID_STATE_TRANSITION", status: 409, correlationId: command.correlationId });
        const approval: ApprovalRecord = Object.freeze({ id: randomUUID(), actionCode: "CONTRACT_VERSION", subjectType: "CONTRACT_VERSION", subjectId: active.id, subjectVersion: active.revisionNo, subjectHash: active.hash, requesterId: command.principal.userId, requestedAt: options.now(), decision: "PENDING", version: 1 });
        const pending = Object.freeze({ ...active, state: "PENDING_APPROVAL" as const, approvalId: approval.id }); const next = Object.freeze({ ...contract, state: "PENDING_APPROVAL", version: contract.version + 1 });
        state.versions.set(pending.id, pending); state.contracts.set(next.id, next); state.approvals.set(approval.id, approval); audit("CONTRACT_SUBMITTED", command.principal.userId, next.id, next.version, command.correlationId);
        return { status: 202, value: clone(approval) };
      }).then(({ value, replayed }) => ({ value, replayed }));
    },
    async applyContractDecision(command) {
      const approval = state.approvals.get(command.approvalId); if (!approval) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.approvalId });
      if (!command.approver.roles.includes("OWNER_ADMIN")) throw problemError({ code: "PERMISSION_DENIED", status: 403, correlationId: command.approvalId });
      if (command.approver.userId === approval.requesterId) throw problemError({ code: "SELF_APPROVAL_FORBIDDEN", status: 409, correlationId: command.approvalId });
      if (approval.decision !== "PENDING") throw problemError({ code: "INVALID_STATE_TRANSITION", status: 409, correlationId: command.approvalId });
      const version = state.versions.get(approval.subjectId); if (!version || version.hash !== approval.subjectHash || version.revisionNo !== approval.subjectVersion) throw problemError({ code: "APPROVAL_VERSION_MISMATCH", status: 409, correlationId: command.approvalId });
      const contract = state.contracts.get(version.contractId)!; if (contract.activeVersionId !== version.id) throw problemError({ code: "APPROVAL_VERSION_MISMATCH", status: 409, correlationId: command.approvalId });
      state.approvals.set(approval.id, Object.freeze({ ...approval, decision: command.decision, approverId: command.approver.userId, decidedAt: options.now(), comment: command.comment, version: 2 }));
      state.versions.set(version.id, Object.freeze({ ...version, state: command.decision })); const next = Object.freeze({ ...contract, state: command.decision, version: contract.version + 1 }); state.contracts.set(next.id, next);
      audit(`CONTRACT_${command.decision}`, command.approver.userId, next.id, next.version, command.approvalId); return exposeContract(next);
    },
    async cancelProject(command) {
      if (!command.principal.roles.includes("OWNER_ADMIN")) throw problemError({ code: "PERMISSION_DENIED", status: 403, correlationId: command.correlationId });
      return executeIdempotently(options.idempotencyStore, { actorId: command.principal.userId, operationId: "cancelUnexecutedProject", key: command.idempotencyKey, request: { projectId: command.projectId, expectedVersion: command.expectedVersion, reason: command.reason }, correlationId: command.correlationId }, async () => {
        const project = state.projects.get(command.projectId); if (!project) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.correlationId }); requireVersion(project.version, command.expectedVersion, command.correlationId);
        if (project.lifecycleState !== "DRAFT" || options.hasExecution?.(project.id)) throw problemError({ code: "INVALID_STATE_TRANSITION", status: 409, correlationId: command.correlationId });
        if (typeof command.reason !== "string" || command.reason.trim().length < 3) throw problemError({ code: "VALIDATION_FAILED", status: 400, correlationId: command.correlationId });
        const next = Object.freeze({ ...project, lifecycleState: "CANCELLED" as const, version: project.version + 1, cancellationReason: command.reason }); state.projects.set(next.id, next); audit("PROJECT_CANCELLED", command.principal.userId, next.id, next.version, command.correlationId);
        return { status: 200, value: exposeProject(next) };
      }).then(({ value, replayed }) => ({ value, replayed }));
    },
  };
  internals.set(service, state); return service;
}

export function readProjectContractState(service: ProjectContractService) {
  const state = internals.get(service); if (!state) return Object.freeze({ projects: [], contracts: [], versions: [], approvals: [], audit: [] });
  return Object.freeze({ projects: Object.freeze([...state.projects.values()].map(clone)), contracts: Object.freeze([...state.contracts.values()].map(clone)), versions: Object.freeze([...state.versions.values()].map(clone)), approvals: Object.freeze([...state.approvals.values()].map(clone)), audit: Object.freeze(state.audit.map(clone)) });
}
