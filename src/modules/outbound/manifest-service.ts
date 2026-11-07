import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { hashOutboundManifest, sha256Bytes } from "./manifest-hash.ts";

export type OutboundPrincipal = Readonly<{ userId: string; displayName?: string; roles: readonly string[] }>;
export type OutboundState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "CANCELLED" | "SUPERSEDED";
export interface OutboundBody { readonly mediaType: string; readonly contentBase64: string; readonly byteLength: number; readonly sha256: string }
export interface OutboundAttachment { readonly id: string; readonly version: number; readonly filename: string; readonly byteLength: number; readonly sha256: string }
export interface ManifestSnapshot {
  readonly manifestId: string; readonly manifestVersion: number; readonly manifestHash: string;
  readonly documentRevisionId: string; readonly documentRevisionVersion: number; readonly outputSha256: string;
  readonly channel: "EMAIL"; readonly to: readonly string[]; readonly cc: readonly string[];
  readonly attachments: readonly OutboundAttachment[]; readonly subject: string; readonly body: OutboundBody;
}
export interface OutboundManifest extends ManifestSnapshot {
  readonly id: string; readonly documentId: string; readonly state: OutboundState; readonly version: number;
  readonly approvalId: string | null; readonly approvedSnapshot: ManifestSnapshot | null; readonly sentSnapshot: ManifestSnapshot | null;
  readonly supersedesManifestId: string | null; readonly reason: string | null;
}
export interface OutboundApproval { id: string; subjectId: string; subjectVersion: number; subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED" }
type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type StoredManifest = Mutable<Omit<OutboundManifest, "to" | "cc" | "attachments" | "body">> & { to: string[]; cc: string[]; attachments: OutboundAttachment[]; body: OutboundBody };
interface DocumentSource { id: string; version: number; activeRevisionId: string; revisionVersion: number; state: string; sha256: string; bytes: Uint8Array }
interface ObjectSource { id: string; version: number; filename: string; sha256: string; bytes: Uint8Array }
interface Replay { hash: string; value: unknown }
interface State { documents: Map<string, DocumentSource>; objects: Map<string, ObjectSource>; manifests: StoredManifest[]; approvals: Map<string, OutboundApproval>; replays: Map<string, Replay> }

const SHA256 = /^[a-f0-9]{64}$/;
const clone = <T>(value: T): T => structuredClone(value);
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function actor(input: Record<string, unknown>, id: string): OutboundPrincipal {
  const value = input.principal as OutboundPrincipal | undefined;
  if (!value?.userId || !Array.isArray(value.roles) || !value.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) fail("PERMISSION_DENIED", 403, id);
  return value;
}
function controlled(input: Record<string, unknown>) {
  return { documentRevisionId: input.documentRevisionId, documentRevisionVersion: input.documentRevisionVersion, outputSha256: input.outputSha256,
    channel: input.channel, to: input.to, cc: input.cc, attachments: input.attachments, subject: input.subject, body: input.body };
}
function validateControlled(input: Record<string, unknown>, state: State, document: DocumentSource, id: string): void {
  const body = input.body as Record<string, unknown> | undefined;
  const attachments = input.attachments as Array<Record<string, unknown>> | undefined;
  const recipientsValid = (value: unknown, required: boolean) => Array.isArray(value) && (!required || value.length > 0) && new Set(value).size === value.length && value.every((item) => typeof item === "string" && item.includes("@"));
  if (input.documentRevisionId !== document.activeRevisionId || input.documentRevisionVersion !== document.revisionVersion || input.outputSha256 !== document.sha256
      || input.channel !== "EMAIL" || !recipientsValid(input.to, true) || !recipientsValid(input.cc, false)
      || typeof input.subject !== "string" || input.subject.length === 0 || !Array.isArray(attachments) || attachments.length === 0
      || !body || typeof body.mediaType !== "string" || typeof body.contentBase64 !== "string" || !Number.isSafeInteger(body.byteLength) || !SHA256.test(String(body.sha256))) fail("VALIDATION_FAILED", 422, id);
  let bodyBytes: Uint8Array; try { bodyBytes = Buffer.from(body.contentBase64 as string, "base64"); } catch { fail("VALIDATION_FAILED", 422, id); }
  if (bodyBytes.byteLength !== body.byteLength || sha256Bytes(bodyBytes) !== body.sha256) fail("VALIDATION_FAILED", 422, id);
  for (const item of attachments) {
    if (typeof item.id !== "string" || !Number.isSafeInteger(item.version) || typeof item.filename !== "string" || !Number.isSafeInteger(item.byteLength) || !SHA256.test(String(item.sha256))) fail("VALIDATION_FAILED", 422, id);
    const stored = state.objects.get(item.id); if (!stored || stored.version !== item.version || stored.bytes.byteLength !== item.byteLength || stored.sha256 !== item.sha256) fail("VALIDATION_FAILED", 422, id);
  }
}
function active(state: State, manifestId: unknown, id: string): StoredManifest {
  const value = state.manifests.filter((row) => row.id === manifestId || row.manifestId === manifestId).at(-1);
  if (!value) fail("RESOURCE_NOT_FOUND", 404, id); return value;
}
function snapshot(value: StoredManifest): ManifestSnapshot {
  return clone({ manifestId: value.manifestId, manifestVersion: value.manifestVersion, manifestHash: value.manifestHash,
    documentRevisionId: value.documentRevisionId, documentRevisionVersion: value.documentRevisionVersion, outputSha256: value.outputSha256,
    channel: value.channel, to: value.to, cc: value.cc, attachments: value.attachments, subject: value.subject, body: value.body });
}

export function createInMemoryManifestService(options: { now: () => string; documents: readonly DocumentSource[]; objects: readonly ObjectSource[] }) {
  const state: State = { documents: new Map(options.documents.map((row) => [row.id, clone(row)])), objects: new Map(options.objects.map((row) => [row.id, clone(row)])), manifests: [], approvals: new Map(), replays: new Map() };
  async function once<T>(operation: string, input: Record<string, unknown>, work: (principal: OutboundPrincipal, id: string) => T | Promise<T>) {
    const id = typeof input.correlationId === "string" ? input.correlationId : randomUUID(), principal = actor(input, id), key = input.idempotencyKey;
    if (typeof key !== "string" || key.length < 8) fail("VALIDATION_FAILED", 422, id);
    const request = Object.fromEntries(Object.entries(input).filter(([name]) => !["principal", "correlationId", "idempotencyKey"].includes(name)));
    const scope = `${principal.userId}:${operation}:${key}`, hash = hashOutboundManifest(request), prior = state.replays.get(scope);
    if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, id); return { value: clone(prior.value) as T, replayed: true }; }
    const value = await work(principal, id); state.replays.set(scope, { hash, value: clone(value) }); return { value: clone(value), replayed: false };
  }
  async function create(input: Record<string, unknown>) { return once("createOutboundManifest", input, (_principal, id) => {
    const document = state.documents.get(String(input.documentId));
    if (!document || document.state !== "APPROVED") fail("DOCUMENT_NOT_APPROVED", 409, id);
    if (input.expectedVersion !== document.version) fail("STALE_VERSION", 412, id); validateControlled(input, state, document, id);
    const manifestId = randomUUID(), manifestVersion = 1, facts = controlled(input), manifestHash = hashOutboundManifest(facts);
    const value: StoredManifest = { ...(clone(facts) as any), id: manifestId, manifestId, manifestVersion, manifestHash, documentId: document.id,
      state: "DRAFT", version: 1, approvalId: null, approvedSnapshot: null, sentSnapshot: null, supersedesManifestId: null, reason: null };
    state.manifests.push(value); return clone(value);
  }); }
  async function preview(manifestId: string) { return clone(active(state, manifestId, `preview-${manifestId}`)); }
  async function submitForApproval(input: Record<string, unknown>) { return once("submitOutboundManifestForApproval", input, (principal, id) => {
    const manifest = active(state, input.manifestId, id); if (input.expectedVersion !== manifest.version) fail("STALE_VERSION", 412, id);
    if (manifest.state !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, id);
    const approval: OutboundApproval = { id: randomUUID(), subjectId: manifest.id, subjectVersion: manifest.version, subjectHash: manifest.manifestHash, requesterId: principal.userId, decision: "PENDING" };
    state.approvals.set(approval.id, approval); manifest.state = "PENDING_APPROVAL"; manifest.approvalId = approval.id; return clone(approval);
  }); }
  async function applyDecision(input: Record<string, unknown>) {
    const id = typeof input.correlationId === "string" ? input.correlationId : randomUUID(), approver = input.approver as OutboundPrincipal | undefined;
    if (!approver?.userId || !Array.isArray(approver.roles)) fail("PERMISSION_DENIED", 403, id);
    const approval = state.approvals.get(String(input.approvalId)); if (!approval) fail("RESOURCE_NOT_FOUND", 404, id);
    if (approval.requesterId === approver.userId) fail("SELF_APPROVAL_FORBIDDEN", 409, id);
    if (!approver.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, id);
    if (approval.decision !== "PENDING" || !["APPROVED", "REJECTED"].includes(String(input.decision))) fail("INVALID_STATE_TRANSITION", 409, id);
    const manifest = active(state, approval.subjectId, id);
    if (manifest.version !== approval.subjectVersion || manifest.manifestHash !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409, id);
    approval.decision = input.decision as "APPROVED" | "REJECTED"; manifest.state = approval.decision === "APPROVED" ? "APPROVED" : "DRAFT";
    if (approval.decision === "APPROVED") manifest.approvedSnapshot = snapshot(manifest); void options.now(); return clone(approval);
  }
  async function revise(input: Record<string, unknown>) { return once("reviseOutboundManifest", input, (_principal, id) => {
    const current = active(state, input.manifestId, id); if (input.expectedVersion !== current.version) fail("STALE_VERSION", 412, id);
    if (!["DRAFT", "APPROVED"].includes(current.state) || typeof input.reason !== "string" || input.reason.trim().length < 3) fail("INVALID_STATE_TRANSITION", 409, id);
    const document = state.documents.get(current.documentId); if (!document) fail("RESOURCE_NOT_FOUND", 404, id);
    // A revision may name a newly stored controlled object/output; exact availability is rechecked at send.
    const relaxedState = { ...state, objects: new Map(state.objects) }; for (const item of (input.attachments as OutboundAttachment[] ?? [])) if (!relaxedState.objects.has(item.id)) relaxedState.objects.set(item.id, { ...item, filename: item.filename, bytes: new Uint8Array(item.byteLength) } as ObjectSource);
    if (input.documentRevisionId !== document.activeRevisionId || input.documentRevisionVersion !== document.revisionVersion || input.channel !== "EMAIL") {
      if (!SHA256.test(String(input.outputSha256))) fail("VALIDATION_FAILED", 422, id);
    }
    const body = input.body as OutboundBody; if (!body || sha256Bytes(Buffer.from(body.contentBase64, "base64")) !== body.sha256) fail("VALIDATION_FAILED", 422, id);
    current.state = "SUPERSEDED"; const facts = controlled(input), nextVersion = current.manifestVersion + 1;
    const next: StoredManifest = { ...(clone(facts) as any), id: randomUUID(), manifestId: current.manifestId, manifestVersion: nextVersion, manifestHash: hashOutboundManifest(facts), documentId: current.documentId,
      state: "DRAFT", version: current.version + 1, approvalId: null, approvedSnapshot: null, sentSnapshot: null, supersedesManifestId: current.id, reason: input.reason.trim() };
    state.manifests.push(next); return clone(next);
  }); }
  async function history(manifestId: string) { const rows = state.manifests.filter((row) => row.manifestId === manifestId || row.id === manifestId); if (!rows.length) fail("RESOURCE_NOT_FOUND", 404); return Object.freeze(rows.map(clone)); }
  async function cancel(input: Record<string, unknown>) { return once("cancelOutboundManifest", input, (_principal, id) => { const value = active(state, input.manifestId, id); if (input.expectedVersion !== value.version) fail("STALE_VERSION", 412, id); if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(value.state)) fail("INVALID_STATE_TRANSITION", 409, id); if (typeof input.reason !== "string" || input.reason.trim().length < 3) fail("VALIDATION_FAILED", 422, id); value.state = "CANCELLED"; value.reason = input.reason.trim(); value.version += 1; return clone(value); }); }
  return { create, preview, revise, submitForApproval, applyDecision, history, cancel, _state: state };
}
