import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const writeRoles = ["OWNER_ADMIN", "OPERATIONS"];
const refs = ["ShipmentId", "IfMatch", "IdempotencyKey", "CsrfToken"].map((name) => `#/components/parameters/${name}`);
function operation(path: string): Record<string, any> {
  const value = api.paths[path]?.post;
  assert.ok(value, `missing POST ${path}`);
  return value;
}

test("shipment approval and confirmation commands expose the exact five fixed operations", () => {
  for (const [path, operationId] of [
    ["/supplier-shipments/{shipmentId}/submit", "submitSupplierShipmentConfirmation"],
    ["/supplier-shipments/{shipmentId}/confirm", "confirmSupplierShipment"],
    ["/sales-shipments/{shipmentId}/submit", "submitSalesShipmentConfirmation"],
    ["/sales-shipments/{shipmentId}/tolerance-exceptions", "requestToleranceException"],
    ["/sales-shipments/{shipmentId}/confirm", "confirmSalesShipment"],
  ]) {
    const command = operation(path);
    assert.equal(command.operationId, operationId);
    assert.deepEqual(command["x-required-roles"], writeRoles);
    assert.deepEqual(command.parameters.map((parameter: Record<string, string>) => parameter.$ref), refs);
  }
});

test("confirmation commands require an exact approval binding and return typed current workspaces", () => {
  for (const [path, workspace] of [
    ["/supplier-shipments/{shipmentId}/confirm", "SupplierShipmentWorkspace"],
    ["/sales-shipments/{shipmentId}/confirm", "SalesShipmentWorkspace"],
  ]) {
    const command = operation(path);
    assert.equal(command.requestBody.$ref, "#/components/requestBodies/ApprovalBinding");
    assert.equal(command.responses["200"].content["application/json"].schema.$ref, `#/components/schemas/${workspace}`);
  }
  const binding = api.components.schemas.ApprovalBinding;
  assert.equal(binding.additionalProperties, false);
  assert.deepEqual(binding.required, ["approvalId"]);
  assert.deepEqual(Object.keys(binding.properties), ["approvalId"]);
  assert.equal(binding.properties.approvalId.$ref, "#/components/schemas/Uuid");
});

test("submission returns approval and tolerance requests require a non-empty reason and breached field set", () => {
  for (const path of ["/supplier-shipments/{shipmentId}/submit", "/sales-shipments/{shipmentId}/submit"])
    assert.equal(operation(path).responses["202"].$ref, "#/components/responses/Approval");
  const tolerance = operation("/sales-shipments/{shipmentId}/tolerance-exceptions");
  assert.equal(tolerance.responses["202"].$ref, "#/components/responses/Approval");
  const body = tolerance.requestBody.content["application/json"].schema;
  assert.equal(tolerance.requestBody.required, true);
  assert.deepEqual(body.required, ["reason", "breachedFields"]);
  assert.equal(body.properties.reason.minLength, 3);
  assert.equal(body.properties.breachedFields.minItems, 1);
});
