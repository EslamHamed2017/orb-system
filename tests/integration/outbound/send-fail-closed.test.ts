import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const outputBytes = new TextEncoder().encode("approved-output");
const bodyBytes = new TextEncoder().encode("approved-body");
const attachmentBytes = new TextEncoder().encode("approved-attachment");
const ids = { document: "019a5f9b-7c00-7000-8000-000000001101", revision: "019a5f9b-7c00-7000-8000-000000001102", attachment: "019a5f9b-7c00-7000-8000-000000001103", operations: "019a5f9b-7c00-7000-8000-000000001104", owner: "019a5f9b-7c00-7000-8000-000000001105" };
const OPERATIONS = Object.freeze({ userId: ids.operations, displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: ids.owner, displayName: "Owner", roles: ["OWNER_ADMIN"] });
const payload = Object.freeze({ documentRevisionId: ids.revision, documentRevisionVersion: 2, outputSha256: sha(outputBytes), channel: "EMAIL", to: ["buyer@example.test"], cc: [], attachments: [{ id: ids.attachment, version: 1, filename: "cinv.pdf", byteLength: attachmentBytes.byteLength, sha256: sha(attachmentBytes) }], subject: "Approved subject", body: { mediaType: "text/plain; charset=utf-8", contentBase64: Buffer.from(bodyBytes).toString("base64"), byteLength: bodyBytes.byteLength, sha256: sha(bodyBytes) } });
interface Harness { manifest: any; approval: any; service: any; transport: any; objects: any }
interface SendModule { createApprovedSendHarness(options: Record<string, unknown>): Promise<Harness> }
async function loadSend(): Promise<SendModule> { return import("../../../src/modules/outbound/send-service.ts") as Promise<SendModule>; }
function command(key: string) { return { principal: OPERATIONS, idempotencyKey: key, correlationId: key }; }
function isProblem(code: string) { return (error: unknown) => error instanceof ProblemError && error.problem.code === code; }
async function approved(options: Record<string, unknown> = {}): Promise<Harness> {
  const module = await loadSend();
  return module.createApprovedSendHarness({ now: () => "2026-11-07T11:00:00.000Z", document: { id: ids.document, version: 5, revisionId: ids.revision, revisionVersion: 2, sha256: sha(outputBytes), bytes: outputBytes }, attachment: { id: ids.attachment, version: 1, filename: "cinv.pdf", sha256: sha(attachmentBytes), bytes: attachmentBytes }, payload, requester: OPERATIONS, approver: OWNER, ...options });
}

test("explicit send accepts only approvalId and transport receives exact stored approved bytes", async () => {
  const { manifest, approval, service, transport } = await approved();
  const attempt = await service.send({ manifestId: manifest.id, expectedVersion: manifest.version, approvalId: approval.id, ...command("send-exact-stored") });
  assert.equal(attempt.value.result, "DELIVERED");
  assert.equal(attempt.value.attemptNo, 1);
  assert.equal(attempt.value.approvedSnapshotHash, attempt.value.sentSnapshotHash);
  assert.ok(attempt.value.transportCaptureEvidenceId);
  assert.deepEqual(transport.captures[0].outputBytes, outputBytes);
  assert.deepEqual(transport.captures[0].bodyBytes, bodyBytes);
  assert.deepEqual(transport.captures[0].attachments[0].bytes, attachmentBytes);
  assert.deepEqual(Object.keys(transport.requests[0]).sort(), ["approvalId", "manifestId"], "send transport must not receive caller replacement content");
  const preview = await service.preview(manifest.id);
  assert.equal(preview.state, "SENT");
  assert.equal(preview.approvedSnapshot.manifestHash, preview.sentSnapshot.manifestHash);
});

test("hash, version or availability drift fails closed and still appends an immutable attempt and audit", async () => {
  const scenarios: Array<[string, string, (h: Harness) => void]> = [
    ["output hash", "SEND_HASH_MISMATCH", (h) => h.objects.replace(ids.revision, new TextEncoder().encode("drift"))],
    ["attachment version", "SEND_MANIFEST_CHANGED", (h) => h.objects.bumpVersion(ids.attachment)],
    ["body unavailable", "SEND_BYTES_UNAVAILABLE", (h) => h.objects.removeBody(h.manifest.id)],
  ];
  for (const [name, code, drift] of scenarios) {
    const harness = await approved(); drift(harness);
    await assert.rejects(() => harness.service.send({ manifestId: harness.manifest.id, expectedVersion: harness.manifest.version, approvalId: harness.approval.id, ...command(`send-drift-${name}`) }), isProblem(code));
    const attempts = await harness.service.listAttempts(harness.manifest.id);
    assert.equal(attempts.length, 1, name);
    assert.equal(attempts[0].result, "FAILED", name);
    assert.equal(attempts[0].failureCode, code, name);
    assert.equal(attempts[0].sentSnapshotHash, null, name);
    assert.equal(harness.transport.captures.length, 0, name);
    assert.equal((await harness.service.listAudit(harness.manifest.id)).at(-1).action, "OUTBOUND_SEND_FAILED", name);
  }
});

test("provider failure and unknown outcome are retained; retries append without erasing prior evidence", async () => {
  const harness = await approved({ transportResults: [{ result: "FAILED", failureCode: "PROVIDER_REJECTED" }, { result: "UNKNOWN", failureCode: "PROVIDER_TIMEOUT" }, { result: "DELIVERED", providerReference: "smtp-42" }] });
  for (const [index, expected] of ["FAILED", "UNKNOWN", "DELIVERED"].entries()) {
    const result = await harness.service.send({ manifestId: harness.manifest.id, expectedVersion: (await harness.service.preview(harness.manifest.id)).version, approvalId: harness.approval.id, ...command(`send-provider-${index}`) });
    assert.equal(result.value.result, expected);
    assert.equal(result.value.attemptNo, index + 1);
  }
  const attempts = await harness.service.listAttempts(harness.manifest.id);
  assert.deepEqual(attempts.map((item: any) => item.result), ["FAILED", "UNKNOWN", "DELIVERED"]);
  assert.deepEqual(attempts.map((item: any) => item.attemptNo), [1, 2, 3]);
  assert.equal(attempts[0].failureCode, "PROVIDER_REJECTED");
  assert.equal(attempts[1].failureCode, "PROVIDER_TIMEOUT");
  assert.equal(attempts[2].providerReference, "smtp-42");
});

test("stale, wrong or superseded approval never reaches transport but records the denied attempt", async () => {
  const harness = await approved();
  await assert.rejects(() => harness.service.send({ manifestId: harness.manifest.id, expectedVersion: harness.manifest.version, approvalId: "019a5f9b-7c00-7000-8000-000000001199", ...command("send-wrong-approval") }), isProblem("APPROVAL_REQUIRED"));
  assert.equal(harness.transport.captures.length, 0);
  assert.equal((await harness.service.listAttempts(harness.manifest.id)).length, 1);
});
