import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const DOCUMENT_ID = "019a5f9b-7c00-7000-8000-000000001001";
const REVISION_ID = "019a5f9b-7c00-7000-8000-000000001002";
const ATTACHMENT_ID = "019a5f9b-7c00-7000-8000-000000001003";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000001004", displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000001005", displayName: "Owner", roles: ["OWNER_ADMIN"] });
const outputBytes = new TextEncoder().encode("approved-cinv-bytes");
const bodyBytes = new TextEncoder().encode("Exact approved body\n");
const attachmentBytes = new TextEncoder().encode("supporting-evidence");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const body = Object.freeze({ mediaType: "text/plain; charset=utf-8", contentBase64: Buffer.from(bodyBytes).toString("base64"), byteLength: bodyBytes.byteLength, sha256: sha(bodyBytes) });
const attachment = Object.freeze({ id: ATTACHMENT_ID, version: 2, filename: "evidence.pdf", byteLength: attachmentBytes.byteLength, sha256: sha(attachmentBytes) });
const controlled = Object.freeze({
  documentRevisionId: REVISION_ID, documentRevisionVersion: 4, outputSha256: sha(outputBytes), channel: "EMAIL",
  to: ["buyer@example.test", "ops@example.test"], cc: ["audit@example.test"], attachments: [attachment],
  subject: "ORB CINV 0042", body,
});
type Principal = typeof OPERATIONS;
interface OutboundService {
  create(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  preview(manifestId: string): Promise<any>;
  revise(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  submitForApproval(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  applyDecision(input: Record<string, unknown>): Promise<any>;
  history(manifestId: string): Promise<readonly any[]>;
}
interface OutboundModule { createInMemoryManifestService(options: Record<string, unknown>): OutboundService }
async function loadOutbound(): Promise<OutboundModule> {
  return import("../../../src/modules/outbound/manifest-service.ts") as Promise<OutboundModule>;
}
function command(key: string, principal: Principal = OPERATIONS) { return { principal, idempotencyKey: key, correlationId: key }; }
function isProblem(code: string, status?: number) { return (error: unknown) => error instanceof ProblemError && error.problem.code === code && (status === undefined || error.problem.status === status); }
async function subject() {
  const module = await loadOutbound();
  const service = module.createInMemoryManifestService({ now: () => "2026-11-07T10:00:00.000Z", documents: [{ id: DOCUMENT_ID, version: 7, activeRevisionId: REVISION_ID, revisionVersion: 4, state: "APPROVED", sha256: sha(outputBytes), bytes: outputBytes }], objects: [{ id: ATTACHMENT_ID, version: 2, filename: "evidence.pdf", sha256: sha(attachmentBytes), bytes: attachmentBytes }] });
  return service;
}
async function draft(service: OutboundService, key = "manifest-create") {
  const result = await service.create({ documentId: DOCUMENT_ID, expectedVersion: 7, ...controlled, ...command(key) });
  assert.equal(result.value.state, "DRAFT");
  assert.match(result.value.manifestHash, /^[a-f0-9]{64}$/);
  return result.value;
}

test("canonical complete manifest preserves ordered recipients, exact body and every attachment fact", async () => {
  const service = await subject();
  const value = await draft(service);
  const preview = await service.preview(value.id);
  assert.deepEqual(preview.to, controlled.to);
  assert.deepEqual(preview.cc, controlled.cc);
  assert.deepEqual(preview.attachments, controlled.attachments);
  assert.deepEqual(preview.body, controlled.body);
  assert.equal(preview.outputSha256, controlled.outputSha256);
  const replay = await service.create({ documentId: DOCUMENT_ID, expectedVersion: 7, ...controlled, ...command("manifest-create") });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, value);
});

test("approval binds the exact canonical manifest version and hash and freezes an immutable snapshot", async () => {
  const service = await subject();
  const created = await draft(service, "manifest-approval-create");
  const pending = await service.submitForApproval({ manifestId: created.id, expectedVersion: created.version, ...command("manifest-submit") });
  assert.deepEqual({ subjectId: pending.value.subjectId, subjectVersion: pending.value.subjectVersion, subjectHash: pending.value.subjectHash }, { subjectId: created.id, subjectVersion: created.version, subjectHash: created.manifestHash });
  await assert.rejects(() => service.applyDecision({ approvalId: pending.value.id, approver: OPERATIONS, decision: "APPROVED", comment: "self" }), isProblem("SELF_APPROVAL_FORBIDDEN", 409));
  await service.applyDecision({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED", comment: "Exact external send approved" });
  const approved = await service.preview(created.id);
  assert.equal(approved.state, "APPROVED");
  assert.equal(approved.approvedSnapshot.manifestHash, created.manifestHash);
  assert.deepEqual(approved.approvedSnapshot.body, controlled.body);
  assert.deepEqual(approved.approvedSnapshot.attachments, controlled.attachments);
  approved.approvedSnapshot.to[0] = "mutated@example.test";
  assert.deepEqual((await service.preview(created.id)).approvedSnapshot.to, controlled.to, "returned preview must not mutate stored approval bytes/metadata");
});

test("every controlled recipient, filename, bytes, subject, body or output change supersedes and invalidates approval", async () => {
  const changes: Array<[string, (input: any) => void]> = [
    ["to", (v) => { v.to = [...v.to].reverse(); }], ["cc", (v) => { v.cc = []; }],
    ["filename", (v) => { v.attachments = [{ ...v.attachments[0], filename: "renamed.pdf" }]; }],
    ["attachment-bytes", (v) => { const bytes = new TextEncoder().encode("changed-evidence"); v.attachments = [{ ...v.attachments[0], byteLength: bytes.byteLength, sha256: sha(bytes) }]; }],
    ["subject", (v) => { v.subject += " revised"; }],
    ["body", (v) => { const bytes = new TextEncoder().encode("Changed exact body"); v.body = { ...v.body, contentBase64: Buffer.from(bytes).toString("base64"), byteLength: bytes.byteLength, sha256: sha(bytes) }; }],
    ["output", (v) => { v.outputSha256 = "f".repeat(64); }],
  ];
  for (const [name, change] of changes) {
    const service = await subject(); const original = await draft(service, `manifest-${name}-create`);
    const submitted = await service.submitForApproval({ manifestId: original.id, expectedVersion: original.version, ...command(`manifest-${name}-submit`) });
    await service.applyDecision({ approvalId: submitted.value.id, approver: OWNER, decision: "APPROVED", comment: "approved" });
    const next: any = structuredClone(controlled); change(next);
    const revised = await service.revise({ manifestId: original.id, expectedVersion: (await service.preview(original.id)).version, reason: `Change ${name}`, ...next, ...command(`manifest-${name}-revise`) });
    assert.equal(revised.value.state, "DRAFT", name);
    assert.notEqual(revised.value.manifestHash, original.manifestHash, name);
    assert.equal(revised.value.approvalId, null, name);
    const history = await service.history(original.id);
    assert.equal(history[0].state, "SUPERSEDED", name);
    assert.equal(history[1].version, revised.value.version, name);
  }
});
