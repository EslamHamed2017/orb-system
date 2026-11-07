import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const writeRoles = ["OWNER_ADMIN", "OPERATIONS"];
const readRoles = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const mutationRefs = ["DocumentId", "IfMatch", "IdempotencyKey", "CsrfToken"].map(
  (name) => `#/components/parameters/${name}`,
);

function operation(path: string, method: "get" | "post" = "post"): Record<string, any> {
  const value = api.paths[path]?.[method];
  assert.ok(value, `missing ${method.toUpperCase()} ${path}`);
  return value;
}

test("document lifecycle exposes only the five fixed generation and revision operations", () => {
  const expected = [
    ["/sales-shipments/{shipmentId}/documents", "post", "generateShipmentDocument"],
    ["/documents/{documentId}/status", "get", "getDocumentGenerationStatus"],
    ["/documents/{documentId}/revisions", "post", "reviseDocument"],
    ["/documents/{documentId}/submit", "post", "submitDocumentForApproval"],
    ["/documents/{documentId}/cancel", "post", "cancelDocumentRevision"],
  ] as const;
  for (const [path, method, operationId] of expected) assert.equal(operation(path, method).operationId, operationId);
});

test("generation is asynchronous, versioned and restricted to the exact shipment dataset", () => {
  const generate = operation("/sales-shipments/{shipmentId}/documents");
  assert.deepEqual(generate["x-required-roles"], writeRoles);
  assert.deepEqual(
    generate.parameters.map((parameter: Record<string, string>) => parameter.$ref),
    ["ShipmentId", "IfMatch", "IdempotencyKey", "CsrfToken"].map((name) => `#/components/parameters/${name}`),
  );
  assert.equal(generate.responses["202"].$ref, "#/components/responses/Entity");
  assert.equal(generate.requestBody.required, true);
  assert.equal(generate.requestBody.content["application/json"].schema.$ref, "#/components/schemas/GenerateDocument");

  const input = api.components.schemas.GenerateDocument;
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.required, ["kind", "language", "sourceDatasetId"]);
  assert.deepEqual(Object.keys(input.properties), ["kind", "language", "sourceDatasetId"]);
  assert.deepEqual(input.properties.kind.enum, ["CINV", "PACKING_LIST"]);
  assert.deepEqual(input.properties.language.enum, ["AR", "EN", "BILINGUAL"]);
  assert.equal(input.properties.sourceDatasetId.$ref, "#/components/schemas/Uuid");
});

test("status is readable by all fixed roles while every lifecycle mutation is concurrency controlled", () => {
  const status = operation("/documents/{documentId}/status", "get");
  assert.deepEqual(status["x-required-roles"], readRoles);
  assert.deepEqual(status.parameters.map((parameter: Record<string, string>) => parameter.$ref), ["#/components/parameters/DocumentId"]);
  assert.equal(status.responses["200"].$ref, "#/components/responses/Entity");

  for (const path of ["/documents/{documentId}/revisions", "/documents/{documentId}/submit", "/documents/{documentId}/cancel"]) {
    const command = operation(path);
    assert.deepEqual(command["x-required-roles"], writeRoles);
    assert.deepEqual(command.parameters.map((parameter: Record<string, string>) => parameter.$ref), mutationRefs);
  }
});

test("revision and cancellation require reasons and exact approval submission returns a pending approval", () => {
  const reasonRef = "#/components/requestBodies/Reason";
  assert.equal(operation("/documents/{documentId}/revisions").requestBody.$ref, reasonRef);
  assert.equal(operation("/documents/{documentId}/cancel").requestBody.$ref, reasonRef);
  assert.equal(operation("/documents/{documentId}/submit").responses["202"].$ref, "#/components/responses/Approval");

  const reason = api.components.requestBodies.Reason.content["application/json"].schema;
  assert.equal(reason.additionalProperties, false);
  assert.deepEqual(reason.required, ["reason"]);
  assert.deepEqual(Object.keys(reason.properties), ["reason"]);
  assert.equal(reason.properties.reason.minLength, 3);
});
