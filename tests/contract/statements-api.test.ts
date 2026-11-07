import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const readRoles = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];

test("getOperationalStatement is the five-type currency-partitioned read contract", () => {
  const operation = api.paths["/statements/{statementType}/{subjectId}"]?.get;
  assert.ok(operation);
  assert.equal(operation.operationId, "getOperationalStatement");
  assert.deepEqual(operation["x-required-roles"], readRoles);
  assert.deepEqual(operation.parameters.slice(0, 2).map((item: any) => item.$ref), [
    "#/components/parameters/StatementType", "#/components/parameters/SubjectId",
  ]);
  assert.deepEqual(api.components.parameters.StatementType.schema.enum, [
    "customer", "supplier", "sales-shipment", "supplier-shipment", "project",
  ]);
  assert.equal(operation.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/Statement");
  const schema = api.components.schemas.Statement;
  assert.deepEqual(schema.required, ["subjectId", "currencySections"]);
  const section = schema.properties.currencySections.items;
  assert.deepEqual(section.required, ["currency", "lines", "balance"]);
  assert.equal(section.properties.currency.$ref, "#/components/schemas/Currency");
  assert.equal(section.properties.lines.items.$ref, "#/components/schemas/Entity");
  assert.equal(section.properties.balance.$ref, "#/components/schemas/Decimal");
});
test("getProjectMarginAndCash exposes four distinct measures with formula and source snapshots", () => {
  const operation = api.paths["/projects/{projectId}/profit"]?.get;
  assert.ok(operation);
  assert.equal(operation.operationId, "getProjectMarginAndCash");
  assert.deepEqual(operation["x-required-roles"], readRoles);
  assert.deepEqual(operation.parameters.map((item: any) => item.$ref), ["#/components/parameters/ProjectId"]);
  assert.equal(operation.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/ProfitView");
  const schema = api.components.schemas.ProfitView;
  assert.deepEqual(schema.required, [
    "expectedMargin", "committedMargin", "actualOperationalMargin", "cashPosition", "formulaVersion", "sources",
  ]);
  for (const measure of ["expectedMargin", "committedMargin", "actualOperationalMargin", "cashPosition"]) {
    assert.equal(schema.properties[measure].$ref, "#/components/schemas/Money", measure);
  }
  assert.equal(schema.properties.formulaVersion.type, "string");
  assert.equal(schema.properties.sources.items.$ref, "#/components/schemas/Entity");
});
