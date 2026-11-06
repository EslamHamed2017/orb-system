import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const ref = (name: string) => `#/components/parameters/${name}`;
const roles = {
  read: ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"],
  write: ["OWNER_ADMIN", "OPERATIONS"],
  owner: ["OWNER_ADMIN"],
};

function operation(path: string, method: string): Record<string, any> {
  const result = api.paths[path]?.[method];
  assert.ok(result, `missing ${method.toUpperCase()} ${path}`);
  return result;
}
function parameterRefs(value: Record<string, any>): string[] {
  return (value.parameters ?? []).map((parameter: Record<string, string>) => parameter.$ref);
}

test("Project and contract lifecycle exposes the exact seven operations and fixed role shaping", () => {
  const expected = [
    ["/projects", "get", "listProjects", roles.read],
    ["/projects", "post", "createProjectWithSalesContract", roles.write],
    ["/projects/{projectId}", "get", "getProject", roles.read],
    ["/projects/{projectId}/purchase-contracts", "post", "createPurchaseContract", roles.write],
    ["/contracts/{contractId}/amendments", "post", "createContractAmendment", roles.write],
    ["/contracts/{contractId}/submit", "post", "submitContractForApproval", roles.write],
    ["/projects/{projectId}/cancel", "post", "cancelUnexecutedProject", roles.owner],
  ] as const;
  for (const [path, method, operationId, requiredRoles] of expected) {
    const value = operation(path, method);
    assert.equal(value.operationId, operationId);
    assert.deepEqual(value["x-required-roles"], requiredRoles);
  }
});

test("every lifecycle mutation has idempotency and CSRF, and aggregate mutations also require If-Match", () => {
  assert.deepEqual(parameterRefs(operation("/projects", "post")), [ref("IdempotencyKey"), ref("CsrfToken")]);
  for (const [path, idRef] of [
    ["/projects/{projectId}/purchase-contracts", "ProjectId"],
    ["/contracts/{contractId}/amendments", "ContractId"],
    ["/contracts/{contractId}/submit", "ContractId"],
    ["/projects/{projectId}/cancel", "ProjectId"],
  ]) {
    assert.deepEqual(parameterRefs(operation(path, "post")), [ref(idRef), ref("IfMatch"), ref("IdempotencyKey"), ref("CsrfToken")]);
  }
});

test("Project creation is closed and atomically requires one sales-contract input", () => {
  const create = operation("/projects", "post");
  assert.equal(create.requestBody.required, true);
  assert.equal(create.requestBody.content["application/json"].schema.$ref, "#/components/schemas/CreateProject");
  assert.equal(create.responses["201"].$ref, "#/components/responses/Entity");
  const schema = api.components.schemas.CreateProject;
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["customerId", "salesContract"]);
  assert.deepEqual(Object.keys(schema.properties), ["customerId", "salesContract"]);
  assert.equal(schema.properties.salesContract.$ref, "#/components/schemas/ContractInput");
});

test("contract input requires exact trade facts and makes every omitted tolerance persist as zero", () => {
  const schema = api.components.schemas.ContractInput;
  assert.deepEqual(schema.required, [
    "counterpartyId", "coffeeSpecificationId", "quantity", "unitPrice", "currency", "route", "incoterm", "namedPlace",
  ]);
  assert.equal(schema.properties.tolerances.description, "Omitted values persist as zero");
  assert.deepEqual(Object.keys(schema.properties.tolerances.properties), [
    "quantityUnder", "quantityOver", "netWeightUnder", "netWeightOver", "grossWeightUnder", "grossWeightOver",
  ]);
  for (const tolerance of Object.values(schema.properties.tolerances.properties) as Array<Record<string, string>>) {
    assert.equal(tolerance.$ref, "#/components/schemas/Decimal");
  }
});

test("amendment, exact approval submission and cancellation response contracts remain explicit", () => {
  const amendment = operation("/contracts/{contractId}/amendments", "post");
  const addition = amendment.requestBody.content["application/json"].schema.allOf[1];
  assert.deepEqual(addition.required, ["reason", "effectiveDate"]);
  assert.equal(addition.properties.reason.minLength, 3);
  assert.equal(addition.properties.effectiveDate.format, "date");
  assert.equal(operation("/contracts/{contractId}/submit", "post").responses["202"].$ref, "#/components/responses/Approval");
  assert.equal(operation("/projects/{projectId}/cancel", "post").requestBody.$ref, "#/components/requestBodies/Reason");
});
