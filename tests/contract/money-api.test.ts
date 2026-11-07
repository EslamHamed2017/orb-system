import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const roles = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const commands = [
  ["/projects/{projectId}/money-movements", "recordMoneyMovement", "ProjectId"],
  ["/money-movements/{movementId}/allocations", "allocateMoneyMovement", "MovementId"],
  ["/money-movements/{movementId}/reverse", "reverseMoneyMovement", "MovementId"],
  ["/allocations/{allocationId}/reverse", "reverseSettlementAllocation", "AllocationId"],
] as const;

function post(path: string): Record<string, any> {
  const operation = api.paths[path]?.post;
  assert.ok(operation, `missing POST ${path}`);
  return operation;
}

function refs(operation: Record<string, any>): string[] {
  return operation.parameters.map((parameter: Record<string, string>) => parameter.$ref);
}

test("money exposes only the four accepted append-only command operations", () => {
  for (const [path, operationId] of commands) {
    assert.equal(post(path).operationId, operationId);
    assert.deepEqual(post(path)["x-required-roles"], roles);
    assert.equal(post(path).responses.default.$ref, "#/components/responses/Problem");
  }
  const moneyOperations = Object.values(api.paths).flatMap((item: any) => Object.values(item))
    .filter((operation: any) => operation?.tags?.includes("Money"))
    .map((operation: any) => operation.operationId).sort();
  assert.deepEqual(moneyOperations, commands.map(([, operationId]) => operationId).sort(),
    "no edit, delete, bank matching, netting or destructive allocation endpoint may exist");
});

test("every money command requires exact version, idempotency and CSRF controls", () => {
  for (const [path, , idParameter] of commands) {
    assert.deepEqual(refs(post(path)), [idParameter, "IfMatch", "IdempotencyKey", "CsrfToken"]
      .map((name) => `#/components/parameters/${name}`), path);
  }
});

test("movement input pins party, contract, kind, exact amount, currency and occurrence facts", () => {
  const operation = post("/projects/{projectId}/money-movements");
  assert.equal(operation.requestBody.required, true);
  assert.equal(operation.requestBody.content["application/json"].schema.$ref, "#/components/schemas/MoneyMovementInput");
  assert.equal(operation.responses["201"].$ref, "#/components/responses/Entity");
  const schema = api.components.schemas.MoneyMovementInput;
  const required = ["partyId", "contractId", "kind", "amount", "currency", "occurredOn", "reference"];
  assert.deepEqual(schema.required, required);
  assert.deepEqual(Object.keys(schema.properties), [...required, "evidenceId"]);
  assert.deepEqual(schema.properties.kind.enum, [
    "CUSTOMER_ADVANCE", "CUSTOMER_RECEIPT", "CUSTOMER_REFUND",
    "SUPPLIER_ADVANCE", "SUPPLIER_PAYMENT", "SUPPLIER_REFUND",
  ]);
  assert.equal(schema.properties.amount.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.currency.$ref, "#/components/schemas/Currency");
  assert.equal(schema.properties.occurredOn.format, "date");
});

test("allocation input is one exact CINV or supplier-invoice target", () => {
  const operation = post("/money-movements/{movementId}/allocations");
  assert.equal(operation.requestBody.content["application/json"].schema.$ref, "#/components/schemas/SettlementAllocationInput");
  assert.equal(operation.responses["201"].$ref, "#/components/responses/Entity");
  const schema = api.components.schemas.SettlementAllocationInput;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["targetType", "targetId", "amount", "currency"]);
  assert.deepEqual(Object.keys(schema.properties), schema.required);
  assert.deepEqual(schema.properties.targetType.enum, ["CINV", "SUPPLIER_INVOICE"]);
  assert.equal(schema.properties.amount.$ref, "#/components/schemas/Decimal");
  assert.equal(schema.properties.currency.$ref, "#/components/schemas/Currency");
});

test("reversals are explicit reasoned commands that append entities", () => {
  const movement = post("/money-movements/{movementId}/reverse");
  assert.equal(movement.requestBody.$ref, "#/components/requestBodies/Reason");
  assert.equal(movement.responses["201"].$ref, "#/components/responses/Entity");
  const allocation = post("/allocations/{allocationId}/reverse");
  assert.equal(allocation.requestBody.$ref, "#/components/requestBodies/AllocationReversalInput");
  assert.equal(allocation.responses["201"].content["application/json"].schema.$ref, "#/components/schemas/Entity");
  const input = api.components.schemas.AllocationReversalInput;
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.required, ["reason"]);
  assert.deepEqual(Object.keys(input.properties), ["reason"]);
  assert.equal(input.properties.reason.minLength, 3);
  assert.match(input.description, /compensating allocation row/i);
  assert.match(input.description, /immutable/i);
});
