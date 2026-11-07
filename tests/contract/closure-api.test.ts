import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const operations = [
  ["/projects/{projectId}/closure-assessment", "assessProjectClosure", ["OWNER_ADMIN", "OPERATIONS"]],
  ["/projects/{projectId}/closure-exceptions", "requestClosureException", ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]],
  ["/projects/{projectId}/final-close/submit", "submitFinalCloseForApproval", ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]],
  ["/projects/{projectId}/final-close", "finalCloseProject", ["OWNER_ADMIN"]],
  ["/projects/{projectId}/reopen/submit", "submitReopenForApproval", ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]],
  ["/projects/{projectId}/reopen", "reopenProject", ["OWNER_ADMIN"]],
] as const;
const post = (path: string): Record<string, any> => {
  const operation = api.paths[path]?.post;
  assert.ok(operation, `missing POST ${path}`);
  return operation;
};
const refs = (operation: Record<string, any>) => operation.parameters.map((item: Record<string, string>) => item.$ref);

test("closure exposes exactly assessment, exception, submit/apply final-close and submit/apply reopen commands", () => {
  for (const [path, operationId, roles] of operations) {
    const operation = post(path);
    assert.equal(operation.operationId, operationId);
    assert.deepEqual(operation["x-required-roles"], roles);
    assert.equal(operation.responses.default.$ref, "#/components/responses/Problem");
  }
  const actual = Object.values(api.paths).flatMap((item: any) => Object.values(item))
    .filter((operation: any) => operation?.tags?.includes("Closure"))
    .map((operation: any) => operation.operationId).sort();
  assert.deepEqual(actual, operations.map(([, id]) => id).sort());
});

test("every closure mutation requires exact Project version, idempotency and CSRF controls", () => {
  for (const [path] of operations) assert.deepEqual(refs(post(path)), ["ProjectId", "IfMatch", "IdempotencyKey", "CsrfToken"]
    .map((name) => `#/components/parameters/${name}`), path);
});

test("assessment response is versioned and returns every typed blocker with eligibility and coverage", () => {
  const operation = post("/projects/{projectId}/closure-assessment");
  assert.equal(operation.responses["201"].content["application/json"].schema.$ref, "#/components/schemas/ClosureAssessment");
  const schema = api.components.schemas.ClosureAssessment;
  assert.deepEqual(schema.required, ["id", "projectId", "projectVersion", "blockers", "assessedAt"]);
  const blocker = schema.properties.blockers.items;
  assert.deepEqual(blocker.required, ["id", "code", "subjectId", "exceptionEligible"]);
  assert.equal(blocker.properties.exceptionEligible.type, "boolean");
  assert.equal(blocker.properties.coveredByApprovalId.$ref, "#/components/schemas/Uuid");
});

test("exception request binds exact assessment, nonempty blocker set and mandatory reason", () => {
  const schema = post("/projects/{projectId}/closure-exceptions").requestBody.content["application/json"].schema;
  assert.deepEqual(schema.required, ["assessmentId", "blockerIds", "reason"]);
  assert.equal(schema.properties.assessmentId.$ref, "#/components/schemas/Uuid");
  assert.equal(schema.properties.blockerIds.minItems, 1);
  assert.equal(schema.properties.blockerIds.items.$ref, "#/components/schemas/Uuid");
  assert.equal(schema.properties.reason.minLength, 3);
  assert.equal(post("/projects/{projectId}/closure-exceptions").responses["202"].$ref, "#/components/responses/Approval");
});

test("final close requires assessment plus approval; reopen requires approval plus reason", () => {
  const submit = post("/projects/{projectId}/final-close/submit");
  assert.deepEqual(submit.requestBody.content["application/json"].schema.required, ["assessmentId"]);
  assert.equal(submit.responses["202"].$ref, "#/components/responses/Approval");
  const close = post("/projects/{projectId}/final-close").requestBody.content["application/json"].schema;
  assert.deepEqual(close.required, ["assessmentId", "approvalId"]);
  const reopenSubmit = post("/projects/{projectId}/reopen/submit");
  assert.equal(reopenSubmit.requestBody.$ref, "#/components/requestBodies/Reason");
  assert.equal(reopenSubmit.responses["202"].$ref, "#/components/responses/Approval");
  const reopen = post("/projects/{projectId}/reopen").requestBody.content["application/json"].schema;
  assert.deepEqual(reopen.required, ["reason", "approvalId"]);
  assert.equal(reopen.properties.reason.minLength, 3);
});
