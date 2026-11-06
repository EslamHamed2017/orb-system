import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const OPENAPI = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const ACTION_CODES = [
  "CONTRACT_VERSION", "SUPPLIER_SHIPMENT_CONFIRMATION", "SALES_SHIPMENT_CONFIRMATION", "TOLERANCE_EXCEPTION",
  "SUPPLIER_INVOICE_CONFIRMATION", "DIRECT_EXPENSE", "EXPENSE_CORRECTION", "DOCUMENT_OUTPUT", "EXTERNAL_SEND",
  "CLAIM_OUTCOME", "CLOSURE_EXCEPTION", "FINAL_CLOSE", "REOPEN",
];
const REQUIRED_FIELDS = [
  "approvalId", "actionCode", "subjectType", "subjectId", "subjectReference", "subjectVersion", "subjectHash",
  "changedFields", "evidence", "detectedConflicts", "requester", "requestedAt", "requiredRole", "decisionContext",
  "approvalState", "approvalVersion",
];
interface ApprovalQueryModule {
  toApprovalInboxItem(row: Record<string, unknown>): Record<string, unknown>;
}
async function loadApprovalQuery(): Promise<ApprovalQueryModule> {
  return import("../../src/modules/approvals/approval-query.ts") as Promise<ApprovalQueryModule>;
}

const ACTOR = { userId: "019a5f9b-7c00-7000-8000-000000000303", displayName: "Operations User", roles: ["OPERATIONS"] };
const EVIDENCE = {
  id: "019a5f9b-7c00-7000-8000-000000000304", sha256: "e".repeat(64), byteLength: 321,
  mediaType: "application/pdf", originalFilename: "amendment.pdf", verificationState: "VERIFIED",
  verifiedAt: "2026-11-06T11:59:00.000Z", verifiedBy: ACTOR, uploadedBy: ACTOR,
  uploadedAt: "2026-11-06T11:58:00.000Z", sourceLinks: [{ subjectType: "ContractVersion", subjectId: "019a5f9b-7c00-7000-8000-000000000302", purpose: "AMENDMENT" }],
};
function inboxRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    approvalId: "019a5f9b-7c00-7000-8000-000000000301", actionCode: "CONTRACT_VERSION",
    subjectType: "CONTRACT_VERSION", subjectId: "019a5f9b-7c00-7000-8000-000000000302",
    subjectReference: "SC-001/v3", subjectVersion: 3, subjectHash: "a".repeat(64),
    changedFields: [{ fieldPath: "/namedPlace", displayLabel: "Named place", before: "Dubai", after: "Jebel Ali" }],
    evidence: [EVIDENCE], detectedConflicts: [{ code: "EXECUTED_QUANTITY", severity: "WARNING", message: "Review executed quantity", subjectType: "CONTRACT_VERSION", subjectId: "019a5f9b-7c00-7000-8000-000000000302" }],
    requester: ACTOR, requestedAt: "2026-11-06T12:00:00.000Z", requiredRole: "OWNER_ADMIN",
    decisionContext: { summary: "Approve contract amendment", reason: "Delivery terms changed", consequences: ["Supersedes revision 2"], proposedOutcome: "APPROVED", selfApprovalAllowed: false },
    approvalState: "PENDING", approvalVersion: 1,
    ...overrides,
  };
}

test("approval operations are Owner-only and use the typed inbox page rather than a generic entity page", () => {
  const list = OPENAPI.paths["/approvals"].get;
  const decide = OPENAPI.paths["/approvals/{approvalId}/decision"].post;
  assert.equal(list.operationId, "listFixedApprovalInbox");
  assert.deepEqual(list["x-required-roles"], ["OWNER_ADMIN"]);
  assert.equal(list.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/ApprovalInboxPage");
  assert.equal(decide.operationId, "decideFixedApproval");
  assert.deepEqual(decide["x-required-roles"], ["OWNER_ADMIN"]);
  assert.deepEqual(decide.parameters.map((parameter: Record<string, string>) => parameter.$ref), [
    "#/components/parameters/ApprovalId", "#/components/parameters/IfMatch",
    "#/components/parameters/IdempotencyKey", "#/components/parameters/CsrfToken",
  ]);
});

test("ApprovalInboxItem is closed and carries every controlled dialog fact with the exact fixed actions", () => {
  const schema = OPENAPI.components.schemas.ApprovalInboxItem;
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, REQUIRED_FIELDS);
  assert.deepEqual(schema.properties.actionCode.enum, ACTION_CODES);
  assert.equal(schema.properties.subjectHash.pattern, "^[a-f0-9]{64}$");
  assert.equal(schema.properties.requiredRole.type, "string");
  assert.equal(schema.properties.requiredRole.const, "OWNER_ADMIN");
  assert.equal(schema.properties.changedFields.items.additionalProperties, false);
  assert.deepEqual(schema.properties.changedFields.items.required, ["fieldPath", "before", "after", "displayLabel"]);
  assert.equal(schema.properties.evidence.items.$ref, "#/components/schemas/EvidenceMetadata");
  assert.deepEqual(schema.properties.detectedConflicts.items.required, ["code", "severity", "message", "subjectType", "subjectId"]);
  assert.equal(schema.properties.requester.$ref, "#/components/schemas/ActorSnapshot");
  assert.equal(schema.properties.decisionContext.additionalProperties, false);
  assert.deepEqual(schema.properties.decisionContext.required, ["summary", "reason", "consequences", "proposedOutcome", "selfApprovalAllowed"]);
  assert.equal(schema.properties.decisionContext.properties.selfApprovalAllowed.type, "boolean");
  assert.equal(schema.properties.decisionContext.properties.selfApprovalAllowed.const, false);

  const page = OPENAPI.components.schemas.ApprovalInboxPage;
  assert.equal(page.additionalProperties, false);
  assert.deepEqual(page.required, ["items", "nextCursor"]);
  assert.equal(page.properties.items.items.$ref, "#/components/schemas/ApprovalInboxItem");
});

test("typed projection renders a complete self-contained item without source-row leakage or refetch", async () => {
  const query = await loadApprovalQuery();
  const source = inboxRow({ internalPolicyId: "must-not-leak", requesterCredentialHash: "must-not-leak" });
  const item = query.toApprovalInboxItem(source);
  assert.deepEqual(Object.keys(item), REQUIRED_FIELDS);
  assert.deepEqual(item, inboxRow());
  assert.notEqual(item, source);
  assert.notEqual(item.changedFields, source.changedFields);
  assert.notEqual(item.evidence, source.evidence);
  assert.equal((item.decisionContext as Record<string, unknown>).selfApprovalAllowed, false);
  assert.equal(Object.hasOwn(item, "entityUrl"), false, "controlled fields cannot depend on an untyped entity refetch");
  assert.equal(Object.hasOwn(item, "internalPolicyId"), false);
  assert.equal(Object.hasOwn(item, "requesterCredentialHash"), false);
});

test("typed projection fails closed when any exact subject, diff, evidence, conflict, requester, role or context fact is absent", async () => {
  const query = await loadApprovalQuery();
  for (const field of REQUIRED_FIELDS) {
    const row = inboxRow();
    delete row[field];
    assert.throws(() => query.toApprovalInboxItem(row), /approval|inbox|required|invalid/i, field);
  }
  assert.throws(() => query.toApprovalInboxItem(inboxRow({ requiredRole: "OPERATIONS" })), /role|owner|invalid/i);
  assert.throws(() => query.toApprovalInboxItem(inboxRow({ decisionContext: { ...(inboxRow().decisionContext as object), selfApprovalAllowed: true } })), /self|approval|invalid/i);
  assert.throws(() => query.toApprovalInboxItem(inboxRow({ subjectHash: "not-a-hash" })), /hash|invalid/i);
});
