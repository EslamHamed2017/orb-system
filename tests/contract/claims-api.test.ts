import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const roles = ["OWNER_ADMIN", "OPERATIONS"];
const operations = [
  ["/projects/{projectId}/claims", "openSimpleClaim", "ProjectId"],
  ["/claims/{claimId}/transition", "moveClaimUnderReview", "ClaimId"],
  ["/claims/{claimId}/submit-outcome", "submitClaimOutcomeForApproval", "ClaimId"],
  ["/claims/{claimId}/apply-outcome", "applyApprovedClaimOutcome", "ClaimId"],
] as const;

function post(path: string): Record<string, any> {
  const operation = api.paths[path]?.post;
  assert.ok(operation, `missing POST ${path}`);
  return operation;
}
function parameterRefs(operation: Record<string, any>): string[] {
  return operation.parameters.map((parameter: Record<string, string>) => parameter.$ref);
}

test("claims expose only open, review, exact outcome submission and approved apply commands", () => {
  for (const [path, operationId] of operations) {
    assert.equal(post(path).operationId, operationId);
    assert.deepEqual(post(path)["x-required-roles"], roles);
    assert.equal(post(path).responses.default.$ref, "#/components/responses/Problem");
  }
  const actual = Object.values(api.paths).flatMap((item: any) => Object.values(item))
    .filter((operation: any) => operation?.tags?.includes("Claims"))
    .map((operation: any) => operation.operationId).sort();
  assert.deepEqual(actual, operations.map(([, operationId]) => operationId).sort(),
    "no direct terminal, settlement, compensation, logistics, discount or netting claim command may exist");
});

test("every claim mutation requires the exact aggregate version, idempotency key and CSRF token", () => {
  for (const [path, , identifier] of operations) {
    assert.deepEqual(parameterRefs(post(path)), [identifier, "IfMatch", "IdempotencyKey", "CsrfToken"]
      .map((name) => `#/components/parameters/${name}`), path);
  }
});

test("open input fixes claim types, parties, shipment links, optional measures and evidence", () => {
  const open = post("/projects/{projectId}/claims");
  assert.equal(open.requestBody.required, true);
  assert.equal(open.requestBody.content["application/json"].schema.$ref, "#/components/schemas/ClaimInput");
  assert.equal(open.responses["201"].$ref, "#/components/responses/Entity");
  const schema = api.components.schemas.ClaimInput;
  assert.deepEqual(schema.required, ["type", "claimantId", "respondentId", "description"]);
  assert.deepEqual(schema.properties.type.enum, ["QUANTITY", "WEIGHT", "QUALITY", "DELIVERY", "PRICE", "DOCUMENT"]);
  assert.equal(schema.properties.salesShipmentId.$ref, "#/components/schemas/Uuid");
  assert.equal(schema.properties.supplierShipmentId.$ref, "#/components/schemas/Uuid");
  assert.equal(schema.properties.quantity.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.amount.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.currency.$ref, "#/components/schemas/Currency");
  assert.equal(schema.properties.evidenceId.$ref, "#/components/schemas/Uuid");
  for (const forbidden of ["discount", "replacementLogistics", "compensation", "netting", "settlement"])
    assert.equal(schema.properties[forbidden], undefined, forbidden);
});

test("review transition has no terminal-state bypass", () => {
  const transition = post("/claims/{claimId}/transition");
  const schema = transition.requestBody.content["application/json"].schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["toState", "reason"]);
  assert.deepEqual(schema.properties.toState.enum, ["UNDER_REVIEW"]);
  assert.equal(schema.properties.reason.minLength, 3);
  assert.equal(transition.responses["200"].$ref, "#/components/responses/Entity");
});

test("outcome submission binds a closed exact proposal while apply accepts only approval identity", () => {
  const submit = post("/claims/{claimId}/submit-outcome");
  assert.equal(submit.requestBody.$ref, "#/components/requestBodies/ClaimOutcomeInput");
  assert.equal(submit.responses["202"].$ref, "#/components/responses/Approval");
  const proposal = api.components.schemas.ClaimOutcomeInput;
  assert.equal(proposal.additionalProperties, false);
  assert.deepEqual(proposal.required, ["outcome", "reason"]);
  assert.deepEqual(Object.keys(proposal.properties), ["outcome", "reason", "evidenceId"]);
  assert.deepEqual(proposal.properties.outcome.enum, ["RESOLVED", "REJECTED"]);
  assert.match(proposal.description, /bound to claim version\/hash/i);
  assert.match(proposal.description, /does not change claim terminal state/i);

  const apply = post("/claims/{claimId}/apply-outcome");
  assert.equal(apply.requestBody.$ref, "#/components/requestBodies/ApprovalBinding");
  assert.equal(api.components.schemas.ApprovalBinding.additionalProperties, false);
  assert.deepEqual(api.components.schemas.ApprovalBinding.required, ["approvalId"]);
  assert.equal(apply.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/Entity");
});
