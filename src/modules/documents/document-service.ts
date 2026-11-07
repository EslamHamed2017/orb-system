import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { renderCommercialDocument, type DocumentKind, type DocumentLanguage } from "./render/bilingual.ts";

type Principal = Readonly<{ userId: string; displayName?: string; roles: readonly string[] }>;
type GenerationState = "QUEUED" | "RENDERING" | "READY" | "FAILED";
type LifecycleState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "CANCELLED" | "SUPERSEDED";
interface Dataset { readonly id: string; readonly shipmentId: string; readonly revisionNo: number; readonly approvalState: string; readonly datasetHash: string; readonly sharedFields: Readonly<Record<string, unknown>> }
export interface DocumentRevision {
  readonly id: string; readonly documentId: string; readonly revisionNo: number; readonly sourceDatasetId: string;
  readonly kind: DocumentKind; readonly language: DocumentLanguage; readonly generationState: GenerationState;
  readonly lifecycleState: LifecycleState; readonly version: number; readonly sha256: string | null;
  readonly bytes: Uint8Array | null; readonly reason: string | null; readonly approvalId: string | null;
}
interface StoredRevision {
  id: string; documentId: string; revisionNo: number; sourceDatasetId: string; kind: DocumentKind; language: DocumentLanguage;
  generationState: GenerationState; lifecycleState: LifecycleState; version: number; sha256: string | null; bytes: Uint8Array | null;
  reason: string | null; approvalId: string | null; sharedFields: Readonly<Record<string, unknown>>;
}
interface Approval { id: string; subjectId: string; subjectVersion: number; subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED" }
interface Replay { hash: string; value: unknown }
interface State { datasets: Map<string, Dataset>; revisions: StoredRevision[]; approvals: Map<string, Approval>; replays: Map<string, Replay> }
export interface DocumentService {
  generate(input: Record<string, unknown>): Promise<{ value: DocumentRevision; replayed: boolean }>;
  runNextGeneration(): Promise<DocumentRevision | null>;
  getStatus(documentId: string): Promise<DocumentRevision>;
  submitForApproval(input: Record<string, unknown>): Promise<{ value: Approval; replayed: boolean }>;
  applyDecision(input: Record<string, unknown>): Promise<Approval>;
  revise(input: Record<string, unknown>): Promise<{ value: DocumentRevision; replayed: boolean }>;
  cancel(input: Record<string, unknown>): Promise<{ value: DocumentRevision; replayed: boolean }>;
  getHistory(documentId: string): Promise<readonly DocumentRevision[]>;
}
const internals = new WeakMap<DocumentService, State>();
const SHA256 = /^[a-f0-9]{64}$/;
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function principal(input: Record<string, unknown>, id: string): Principal { const actor = input.principal as Principal | undefined; if (!actor?.userId || !Array.isArray(actor.roles) || !actor.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) fail("PERMISSION_DENIED", 403, id); return actor; }
function publicRevision(value: StoredRevision): DocumentRevision { const { sharedFields: _sharedFields, ...revision } = value; return clone(revision); }
function active(state: State, documentId: unknown, id: string): StoredRevision { const items = state.revisions.filter((row) => row.documentId === documentId); const value = items.at(-1); if (!value) fail("RESOURCE_NOT_FOUND", 404, id); return value; }
function validateReason(reason: unknown, id: string): string { if (typeof reason !== "string" || reason.trim().length < 3) fail("VALIDATION_FAILED", 422, id); return reason.trim(); }

export function createInMemoryDocumentService(options: { now: () => string; datasets: readonly Dataset[] }): DocumentService {
  const state: State = { datasets: new Map(options.datasets.map((row) => [row.id, clone(row)])), revisions: [], approvals: new Map(), replays: new Map() };
  async function once<T>(operation: string, input: Record<string, unknown>, work: (actor: Principal, id: string) => Promise<T> | T): Promise<{ value: T; replayed: boolean }> {
    const id = typeof input.correlationId === "string" ? input.correlationId : randomUUID(), actor = principal(input, id), key = input.idempotencyKey;
    if (typeof key !== "string" || key.length < 8) fail("VALIDATION_FAILED", 422, id);
    const request = Object.fromEntries(Object.entries(input).filter(([name]) => !["principal", "correlationId", "idempotencyKey"].includes(name)));
    const scope = `${actor.userId}:${operation}:${key}`, hash = digest(request), prior = state.replays.get(scope);
    if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, id); return { value: clone(prior.value) as T, replayed: true }; }
    const value = await work(actor, id); state.replays.set(scope, { hash, value: clone(value) }); return { value: clone(value), replayed: false };
  }
  async function generate(input: Record<string, unknown>) {
    return once("generateShipmentDocument", input, (_actor, id) => {
      if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1 || !["CINV", "PACKING_LIST"].includes(String(input.kind)) || !["AR", "EN", "BILINGUAL"].includes(String(input.language))) fail("VALIDATION_FAILED", 422, id);
      const dataset = state.datasets.get(String(input.sourceDatasetId));
      if (!dataset || dataset.shipmentId !== input.shipmentId || dataset.approvalState !== "APPROVED" || !SHA256.test(dataset.datasetHash)) fail("DOCUMENT_SOURCE_DATASET_INVALID", 409, id);
      const documentId = randomUUID();
      const revision: StoredRevision = { id: randomUUID(), documentId, revisionNo: 1, sourceDatasetId: dataset.id, kind: input.kind as DocumentKind, language: input.language as DocumentLanguage, generationState: "QUEUED", lifecycleState: "DRAFT", version: 1, sha256: null, bytes: null, reason: null, approvalId: null, sharedFields: clone(dataset.sharedFields) };
      state.revisions.push(revision); return publicRevision(revision);
    });
  }
  async function runNextGeneration(): Promise<DocumentRevision | null> {
    const revision = state.revisions.find((row) => row.generationState === "RENDERING") ?? state.revisions.find((row) => row.generationState === "QUEUED");
    if (!revision) return null;
    if (revision.generationState === "QUEUED") { revision.generationState = "RENDERING"; revision.version += 1; return publicRevision(revision); }
    const rendered = await renderCommercialDocument({ kind: revision.kind, language: revision.language, sourceDatasetId: revision.sourceDatasetId, sharedFields: revision.sharedFields });
    revision.generationState = "READY"; revision.bytes = Uint8Array.from(rendered.bytes); revision.sha256 = rendered.sha256; revision.version += 1;
    return publicRevision(revision);
  }
  async function getStatus(documentId: string) { return publicRevision(active(state, documentId, `status-${documentId}`)); }
  async function submitForApproval(input: Record<string, unknown>) {
    return once("submitDocumentForApproval", input, (actor, id) => {
      const revision = active(state, input.documentId, id);
      if (revision.generationState !== "READY" || revision.lifecycleState !== "DRAFT" || !revision.sha256) fail("INVALID_STATE_TRANSITION", 409, id);
      if (input.expectedVersion !== revision.version) fail("STALE_VERSION", 412, id);
      const approval: Approval = { id: randomUUID(), subjectId: revision.id, subjectVersion: revision.version, subjectHash: revision.sha256, requesterId: actor.userId, decision: "PENDING" };
      state.approvals.set(approval.id, approval); revision.lifecycleState = "PENDING_APPROVAL"; revision.approvalId = approval.id; return clone(approval);
    });
  }
  async function applyDecision(input: Record<string, unknown>): Promise<Approval> {
    const id = typeof input.correlationId === "string" ? input.correlationId : randomUUID(), actor = input.approver as Principal | undefined;
    if (!actor?.userId || !Array.isArray(actor.roles)) fail("PERMISSION_DENIED", 403, id);
    const approval = state.approvals.get(String(input.approvalId)); if (!approval) fail("RESOURCE_NOT_FOUND", 404, id);
    if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409, id);
    if (approval.requesterId === actor.userId) fail("SELF_APPROVAL_FORBIDDEN", 409, id);
    if (!actor.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, id);
    if (input.decision !== "APPROVED" && input.decision !== "REJECTED") fail("VALIDATION_FAILED", 422, id);
    const revision = state.revisions.find((row) => row.id === approval.subjectId); if (!revision || revision.version !== approval.subjectVersion || revision.sha256 !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409, id);
    approval.decision = input.decision; revision.lifecycleState = input.decision === "APPROVED" ? "APPROVED" : "DRAFT"; void options.now(); return clone(approval);
  }
  async function revise(input: Record<string, unknown>) {
    return once("reviseDocument", input, (_actor, id) => {
      const current = active(state, input.documentId, id); if (input.expectedVersion !== current.version) fail("STALE_VERSION", 412, id);
      if (!["DRAFT", "APPROVED"].includes(current.lifecycleState) || current.generationState !== "READY") fail("INVALID_STATE_TRANSITION", 409, id);
      const reason = validateReason(input.reason, id); current.lifecycleState = "SUPERSEDED";
      const next: StoredRevision = { ...clone(current), id: randomUUID(), revisionNo: current.revisionNo + 1, generationState: "QUEUED", lifecycleState: "DRAFT", version: 1, sha256: null, bytes: null, reason, approvalId: null };
      state.revisions.push(next); return publicRevision(next);
    });
  }
  async function cancel(input: Record<string, unknown>) {
    return once("cancelDocumentRevision", input, (_actor, id) => {
      const revision = active(state, input.documentId, id); if (input.expectedVersion !== revision.version) fail("STALE_VERSION", 412, id);
      if (revision.lifecycleState !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, id);
      revision.reason = validateReason(input.reason, id); revision.lifecycleState = "CANCELLED"; revision.version += 1; return publicRevision(revision);
    });
  }
  async function getHistory(documentId: string) { const rows = state.revisions.filter((row) => row.documentId === documentId).sort((a, b) => a.revisionNo - b.revisionNo); if (!rows.length) fail("RESOURCE_NOT_FOUND", 404); return Object.freeze(rows.map(publicRevision)); }
  const service: DocumentService = { generate, runNextGeneration, getStatus, submitForApproval, applyDecision, revise, cancel, getHistory };
  internals.set(service, state); return service;
}
