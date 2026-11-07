import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createInMemoryManifestService } from "./manifest-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { sha256Bytes, snapshotHash } from "./manifest-hash.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createInMemoryOutboundTransport } from "./transport.ts";

const clone = <T>(value: T): T => structuredClone(value);
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }

export async function createApprovedSendHarness(options: Record<string, any>) {
  const document = options.document, attachment = options.attachment, payload = options.payload;
  const manifests = createInMemoryManifestService({ now: options.now, documents: [{ id: document.id, version: document.version, activeRevisionId: document.revisionId, revisionVersion: document.revisionVersion, state: "APPROVED", sha256: document.sha256, bytes: document.bytes }], objects: [attachment] });
  const created = await manifests.create({ documentId: document.id, expectedVersion: document.version, ...payload, principal: options.requester, idempotencyKey: "harness-create", correlationId: "harness-create" });
  const submitted = await manifests.submitForApproval({ manifestId: created.value.id, expectedVersion: created.value.version, principal: options.requester, idempotencyKey: "harness-submit", correlationId: "harness-submit" });
  await manifests.applyDecision({ approvalId: submitted.value.id, approver: options.approver, decision: "APPROVED", comment: "approved", correlationId: "harness-approve" });
  const transport = createInMemoryOutboundTransport(options.transportResults);
  const output = { version: document.revisionVersion, bytes: Uint8Array.from(document.bytes) };
  const attachmentStore = { version: attachment.version, bytes: Uint8Array.from(attachment.bytes) };
  let bodyAvailable = true;
  const attempts: any[] = [], audit: any[] = [], replays = new Map<string, any>();
  const objects = {
    replace(id: string, bytes: Uint8Array) { if (id === document.revisionId) output.bytes = Uint8Array.from(bytes); else if (id === attachment.id) attachmentStore.bytes = Uint8Array.from(bytes); },
    bumpVersion(id: string) { if (id === attachment.id) attachmentStore.version += 1; },
    removeBody(_manifestId: string) { bodyAvailable = false; },
  };
  async function send(input: Record<string, any>) {
    const current = await manifests.preview(input.manifestId), attemptNo = attempts.length + 1;
    const base = { id: randomUUID(), manifestId: current.manifestId, manifestVersion: current.manifestVersion, manifestHash: current.manifestHash,
      approvalId: input.approvalId, attemptNo, requestedAt: options.now(), completedAt: options.now(), approvedSnapshotHash: current.approvedSnapshot ? snapshotHash(current.approvedSnapshot) : null,
      sentSnapshotHash: null, transportCaptureEvidenceId: null, providerReference: null, failureCode: null };
    const deny = (code: string, status = 409): never => { attempts.push(Object.freeze({ ...base, result: "FAILED", failureCode: code })); audit.push({ action: "OUTBOUND_SEND_FAILED", code }); fail(code, status, input.correlationId); };
    if (input.expectedVersion !== current.version) deny("STALE_VERSION", 412);
    if (!current.approvedSnapshot || current.approvalId !== input.approvalId || current.state === "SUPERSEDED" || current.state === "CANCELLED") deny("APPROVAL_REQUIRED");
    const approval = manifests._state.approvals.get(String(input.approvalId)); if (!approval || approval.decision !== "APPROVED" || approval.subjectHash !== current.manifestHash) deny("APPROVAL_REQUIRED");
    if (!bodyAvailable) deny("SEND_BYTES_UNAVAILABLE");
    if (output.version !== current.documentRevisionVersion || attachmentStore.version !== current.attachments[0].version) deny("SEND_MANIFEST_CHANGED");
    const bodyBytes = Buffer.from(current.body.contentBase64, "base64");
    if (sha256Bytes(output.bytes) !== current.outputSha256 || sha256Bytes(bodyBytes) !== current.body.sha256 || sha256Bytes(attachmentStore.bytes) !== current.attachments[0].sha256) deny("SEND_HASH_MISMATCH");
    const capture = { outputBytes: output.bytes, bodyBytes, attachments: [{ ...current.attachments[0], bytes: attachmentStore.bytes }] };
    const result = await transport.send({ manifestId: current.manifestId, approvalId: input.approvalId }, capture);
    const sentSnapshot = clone(current.approvedSnapshot), sentHash = snapshotHash(sentSnapshot);
    const attempt = Object.freeze({ ...base, result: result.result, providerReference: result.providerReference ?? null, failureCode: result.failureCode ?? null,
      sentSnapshotHash: sentHash, transportCaptureEvidenceId: randomUUID() }); attempts.push(attempt);
    const stored = manifests._state.manifests.at(-1)!; stored.sentSnapshot = sentSnapshot; if (result.result === "DELIVERED" || result.result === "ACCEPTED") stored.state = "SENT"; stored.version += 1;
    audit.push({ action: result.result === "FAILED" || result.result === "UNKNOWN" ? "OUTBOUND_SEND_FAILED" : "OUTBOUND_SENT", result: result.result });
    replays.set(String(input.idempotencyKey), clone(attempt)); return { value: clone(attempt), replayed: false };
  }
  const service = { send, preview: manifests.preview, listAttempts: async (id: string) => Object.freeze(attempts.filter((row) => row.manifestId === id).map(clone)), listAudit: async (_id: string) => Object.freeze(audit.map(clone)) };
  return { manifest: await manifests.preview(created.value.id), approval: clone(submitted.value), service, transport, objects };
}
