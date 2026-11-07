import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const checklistPath = "/sales-shipments/{shipmentId}/route-checklist";
const itemPath = "/sales-shipments/{shipmentId}/route-items/{itemId}";

function refs(parameters: readonly Record<string, string>[]): string[] {
  return parameters.map((parameter) => parameter.$ref);
}

test("fixed checklist API exposes the exact read and versioned item update operations", () => {
  const read = api.paths[checklistPath]?.get;
  assert.ok(read);
  assert.equal(read.operationId, "getFixedRouteChecklist");
  assert.deepEqual(refs(read.parameters), ["#/components/parameters/ShipmentId"]);
  assert.deepEqual(read["x-required-roles"], ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);

  const update = api.paths[itemPath]?.patch;
  assert.ok(update);
  assert.equal(update.operationId, "updateRouteEvidenceOrMilestone");
  assert.deepEqual(refs(update.parameters), [
    "#/components/parameters/ShipmentId",
    "#/components/parameters/ItemId",
    "#/components/parameters/IfMatch",
    "#/components/parameters/IdempotencyKey",
    "#/components/parameters/CsrfToken",
  ]);
  assert.deepEqual(update["x-required-roles"], ["OWNER_ADMIN", "OPERATIONS"]);
  assert.equal(update.requestBody.required, true);
  assert.deepEqual(Object.keys(update.requestBody.content["application/json"].schema.properties).sort(), [
    "evidenceId", "milestoneAt", "state",
  ]);
});

test("Release 1 has exactly three fixed trade routes and no route-template mutation surface", () => {
  assert.deepEqual(api.components.schemas.TradeRoute.enum, [
    "FOREIGN_TO_FOREIGN",
    "UAE_FREE_ZONE_REEXPORT",
    "UAE_IMPORT",
  ]);

  for (const path of Object.keys(api.paths)) {
    assert.doesNotMatch(path, /route[-_/]?(templates?|designer|rules?|configuration)/i);
  }
  assert.deepEqual(Object.keys(api.paths[checklistPath]), ["get"]);
  assert.deepEqual(Object.keys(api.paths[itemPath]), ["patch"]);
});
