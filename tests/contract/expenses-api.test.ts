import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const operations = [
  ["/projects/{projectId}/expenses", "createDirectExpense", "ProjectId"],
  ["/expenses/{expenseId}/submit", "submitDirectExpense", "ExpenseId"],
  ["/expenses/{expenseId}/corrections/submit", "submitApprovedExpenseCorrection", "ExpenseId"],
  ["/expenses/{expenseId}/corrections/apply", "applyApprovedExpenseCorrection", "ExpenseId"],
] as const;
const roles = ["OWNER_ADMIN", "OPERATIONS"];
/** Finance records expenses too; cancelling (with a reason) is for Owner and Finance. */
const ROLE_OVERRIDES: Record<string, string[]> = { createDirectExpense: ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"] };
function post(path: string): Record<string, any> {
  const value = api.paths[path]?.post;
  assert.ok(value, `missing POST ${path}`);
  return value;
}
function refs(value: Record<string, any>): string[] {
  return value.parameters.map((parameter: Record<string, string>) => parameter.$ref);
}

test("expenses expose only create, submit, cancel and exact correction submit/apply commands", () => {
  for (const [path, operationId] of operations) {
    assert.equal(post(path).operationId, operationId);
    assert.deepEqual(post(path)["x-required-roles"], ROLE_OVERRIDES[operationId] ?? roles);
    assert.equal(post(path).responses.default.$ref, "#/components/responses/Problem");
  }
  const actual = Object.values(api.paths).flatMap((item: any) => Object.values(item))
    .filter((operation: any) => operation?.tags?.includes("Expenses"))
    .map((operation: any) => operation.operationId).sort();
  assert.deepEqual(actual, [...operations.map(([, operationId]) => operationId), "cancelDirectExpense"].sort(),
    "no edit, delete, allocation or shared-expense operation may exist");
  const cancel = post("/expenses/{expenseId}/cancel");
  assert.equal(cancel.operationId, "cancelDirectExpense");
  assert.deepEqual(cancel["x-required-roles"], ["OWNER_ADMIN", "FINANCE_VIEWER"]);
  assert.equal(cancel.requestBody.$ref, "#/components/requestBodies/Reason");
});

test("every expense mutation requires exact version, idempotency and CSRF controls", () => {
  for (const [path, , identifier] of operations) {
    assert.deepEqual(refs(post(path)), [identifier, "IfMatch", "IdempotencyKey", "CsrfToken"]
      .map((name) => `#/components/parameters/${name}`), path);
  }
});

test("direct expense upload is closed and carries the bill, the payee and the manual AED rate", () => {
  const create = post("/projects/{projectId}/expenses");
  assert.equal(create.requestBody.content["multipart/form-data"].schema.$ref, "#/components/schemas/DirectExpenseUpload");
  assert.equal(create.responses["201"].$ref, "#/components/responses/Entity");
  const schema = api.components.schemas.DirectExpenseUpload;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["categoryCode", "amount", "currency", "fxRate", "occurredOn", "file"]);
  assert.deepEqual(Object.keys(schema.properties), ["categoryCode", "supplierId", "payeeName", "description", "shipmentType", "shipmentId", "amount", "currency", "fxRate", "occurredOn", "file"]);
  assert.deepEqual(schema.properties.shipmentType.enum, ["SUPPLIER", "SALES"]);
  assert.equal(schema.properties.amount.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.fxRate.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.file.format, "binary");
  assert.equal(schema.properties.salesShipmentIds, undefined, "multi-shipment allocation is absent");
});

test("initial submit carries no replacement facts and creates fixed approval", () => {
  const submit = post("/expenses/{expenseId}/submit");
  assert.equal(submit.requestBody, undefined);
  assert.equal(submit.responses["202"].$ref, "#/components/responses/Approval");
});

test("correction submission binds a reason and full replacement while apply accepts only approval identity", () => {
  const submit = post("/expenses/{expenseId}/corrections/submit");
  assert.equal(submit.requestBody.$ref, "#/components/requestBodies/ExpenseCorrectionInput");
  assert.equal(submit.responses["202"].content["application/json"].schema.$ref, "#/components/schemas/Approval");
  const correction = api.components.schemas.ExpenseCorrectionInput;
  assert.equal(correction.additionalProperties, false);
  assert.deepEqual(correction.required, ["reason", "replacement"]);
  assert.deepEqual(Object.keys(correction.properties), ["reason", "replacement"]);
  assert.equal(correction.properties.reason.minLength, 3);
  assert.equal(correction.properties.replacement.$ref, "#/components/schemas/DirectExpenseInput");
  assert.match(correction.description, /atomically cancels/i);
  assert.match(correction.description, /never edits\/deletes/i);

  const apply = post("/expenses/{expenseId}/corrections/apply");
  assert.equal(apply.requestBody.$ref, "#/components/requestBodies/ApprovalBinding");
  assert.equal(apply.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/Entity");
});
