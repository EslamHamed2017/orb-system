import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const writeRoles = ["OWNER_ADMIN", "OPERATIONS"];
const readRoles = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const mutationParameters = ["ManifestId", "IfMatch", "IdempotencyKey", "CsrfToken"].map(
  (name) => `#/components/parameters/${name}`,
);

function operation(path: string, method: "get" | "post"): Record<string, any> {
  const value = api.paths[path]?.[method];
  assert.ok(value, `missing ${method.toUpperCase()} ${path}`);
  return value;
}
function refs(value: Record<string, any>): string[] {
  return value.parameters.map((parameter: Record<string, string>) => parameter.$ref);
}

test("outbound exposes exactly the seven fixed preview, revision, approval, send and attempt operations", () => {
  const expected = [
    ["/documents/{documentId}/outbound-manifests", "post", "createOutboundManifest"],
    ["/outbound-manifests/{manifestId}", "get", "getOutboundManifestExactPreview"],
    ["/outbound-manifests/{manifestId}/revisions", "post", "reviseOutboundManifest"],
    ["/outbound-manifests/{manifestId}/submit", "post", "submitOutboundManifestForApproval"],
    ["/outbound-manifests/{manifestId}/cancel", "post", "cancelOutboundManifest"],
    ["/outbound-manifests/{manifestId}/send", "post", "sendApprovedOutboundManifest"],
    ["/outbound-manifests/{manifestId}/send-attempts", "get", "listOutboundSendAttempts"],
  ] as const;
  for (const [path, method, operationId] of expected) assert.equal(operation(path, method).operationId, operationId);
});

test("manifest create and revise accept only the canonical complete controlled payload", () => {
  const create = operation("/documents/{documentId}/outbound-manifests", "post");
  assert.deepEqual(create["x-required-roles"], writeRoles);
  assert.deepEqual(refs(create), ["DocumentId", "IfMatch", "IdempotencyKey", "CsrfToken"].map((name) => `#/components/parameters/${name}`));
  assert.equal(create.requestBody.content["application/json"].schema.$ref, "#/components/schemas/OutboundManifestInput");
  const revise = operation("/outbound-manifests/{manifestId}/revisions", "post");
  assert.deepEqual(refs(revise), mutationParameters);
  assert.equal(revise.requestBody.$ref, "#/components/requestBodies/OutboundManifestInput");

  const input = api.components.schemas.OutboundManifestInput;
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.required, ["documentRevisionId", "documentRevisionVersion", "outputSha256", "channel", "to", "cc", "attachments", "subject", "body"]);
  assert.deepEqual(Object.keys(input.properties), input.required);
  assert.deepEqual(input.properties.channel.enum, ["EMAIL"]);
  assert.equal(input.properties.to.minItems, 1);
  assert.equal(input.properties.to.uniqueItems, true);
  assert.equal(input.properties.cc.uniqueItems, true);
  assert.equal(input.properties.attachments.minItems, 1);

  const body = api.components.schemas.OutboundBody;
  assert.equal(body.additionalProperties, false);
  assert.deepEqual(body.required, ["mediaType", "contentBase64", "byteLength", "sha256"]);
  const attachment = api.components.schemas.OutboundAttachment;
  assert.equal(attachment.additionalProperties, false);
  assert.deepEqual(attachment.required, ["id", "version", "filename", "byteLength", "sha256"]);
});

test("exact preview is role-readable and contains immutable approved and sent snapshots", () => {
  const preview = operation("/outbound-manifests/{manifestId}", "get");
  assert.deepEqual(preview["x-required-roles"], readRoles);
  assert.deepEqual(refs(preview), ["#/components/parameters/ManifestId"]);
  assert.equal(preview.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/OutboundManifest");
  const manifest = api.components.schemas.OutboundManifest;
  assert.equal(manifest.additionalProperties, false);
  for (const field of ["manifestHash", "documentRevisionId", "documentRevisionVersion", "outputSha256", "channel", "to", "cc", "attachments", "subject", "body", "approvedSnapshot", "sentSnapshot"]) assert.ok(manifest.required.includes(field), `preview omits ${field}`);
  assert.deepEqual(manifest.properties.state.enum, ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CANCELLED", "SUPERSEDED"]);
  for (const field of ["approvedSnapshot", "sentSnapshot"]) assert.equal(manifest.properties[field].oneOf[0].$ref, "#/components/schemas/OutboundImmutableSnapshot");
});

test("submit, cancel and explicit send are concurrency controlled and send accepts only an approval binding", () => {
  for (const suffix of ["submit", "cancel", "send"]) {
    const command = operation(`/outbound-manifests/{manifestId}/${suffix}`, "post");
    assert.deepEqual(command["x-required-roles"], writeRoles);
    assert.deepEqual(refs(command), mutationParameters);
  }
  assert.equal(operation("/outbound-manifests/{manifestId}/submit", "post").responses["202"].$ref, "#/components/responses/Approval");
  assert.equal(operation("/outbound-manifests/{manifestId}/cancel", "post").requestBody.$ref, "#/components/requestBodies/Reason");
  assert.equal(operation("/outbound-manifests/{manifestId}/send", "post").requestBody.$ref, "#/components/requestBodies/ApprovalBinding");
  const binding = api.components.schemas.ApprovalBinding;
  assert.equal(binding.additionalProperties, false);
  assert.deepEqual(binding.required, ["approvalId"]);
  assert.deepEqual(Object.keys(binding.properties), ["approvalId"]);
});

test("send-attempt history is append-only shaped and readable by all fixed roles", () => {
  const list = operation("/outbound-manifests/{manifestId}/send-attempts", "get");
  assert.deepEqual(list["x-required-roles"], readRoles);
  assert.deepEqual(refs(list), ["#/components/parameters/ManifestId"]);
  assert.equal(list.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/SendAttemptPage");
  const attempt = api.components.schemas.SendAttempt;
  for (const field of ["manifestId", "manifestVersion", "manifestHash", "attemptNo", "requestedAt", "result", "approvedSnapshotHash", "sentSnapshotHash", "transportCaptureEvidenceId"]) assert.ok(attempt.required.includes(field), `attempt omits ${field}`);
  assert.deepEqual(attempt.properties.result.enum, ["ACCEPTED", "DELIVERED", "FAILED", "UNKNOWN"]);
});
