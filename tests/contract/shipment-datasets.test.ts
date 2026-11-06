import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const schemas = api.components.schemas;
const UUID = "#/components/schemas/Uuid";
const readRoles = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const writeRoles = ["OWNER_ADMIN", "OPERATIONS"];

function operation(path: string, method: string): Record<string, any> {
  const value = api.paths[path]?.[method];
  assert.ok(value, `missing ${method.toUpperCase()} ${path}`);
  return value;
}
function responseSchema(path: string, method: string, status: string): string {
  return operation(path, method).responses[status].content["application/json"].schema.$ref;
}
function parameterRefs(path: string, method: string): string[] {
  return (operation(path, method).parameters ?? []).map((parameter: Record<string, string>) => parameter.$ref);
}

test("shipment dataset operations expose distinct typed workspaces, histories and fixed roles", () => {
  const expected = [
    ["/projects/{projectId}/supplier-shipments", "post", "createSupplierShipment", writeRoles],
    ["/supplier-shipments/{shipmentId}", "get", "getSupplierShipmentWorkspace", readRoles],
    ["/supplier-shipments/{shipmentId}/datasets", "get", "listSupplierShipmentDatasetHistory", readRoles],
    ["/projects/{projectId}/sales-shipments", "post", "createSalesShipment", writeRoles],
    ["/sales-shipments/{shipmentId}", "get", "getSalesShipmentWorkspace", readRoles],
    ["/sales-shipments/{shipmentId}/datasets", "get", "listSalesShipmentDatasetHistory", readRoles],
    ["/sales-shipments/{shipmentId}/primary-source", "put", "setPrimarySupplierSource", writeRoles],
  ] as const;
  for (const [path, method, operationId, roles] of expected) {
    assert.equal(operation(path, method).operationId, operationId);
    assert.deepEqual(operation(path, method)["x-required-roles"], roles);
  }
  assert.equal(responseSchema(expected[0][0], "post", "201"), "#/components/schemas/SupplierShipmentWorkspace");
  assert.equal(responseSchema(expected[1][0], "get", "200"), "#/components/schemas/SupplierShipmentWorkspace");
  assert.equal(responseSchema(expected[2][0], "get", "200"), "#/components/schemas/SupplierShipmentDatasetHistory");
  assert.equal(responseSchema(expected[3][0], "post", "201"), "#/components/schemas/SalesShipmentWorkspace");
  assert.equal(responseSchema(expected[4][0], "get", "200"), "#/components/schemas/SalesShipmentWorkspace");
  assert.equal(responseSchema(expected[5][0], "get", "200"), "#/components/schemas/SalesShipmentDatasetHistory");
});

test("supplier and sales create payloads are closed, separate, and require every authoritative fact", () => {
  const supplier = schemas.SupplierShipmentCreateInput;
  const sales = schemas.SalesShipmentCreateInput;
  assert.equal(supplier.additionalProperties, false);
  assert.equal(sales.additionalProperties, false);
  for (const field of ["purchaseContractId", "supplierId", "supplierLotReference"]) {
    assert.ok(supplier.required.includes(field), `supplier missing ${field}`);
    assert.equal(Object.hasOwn(sales.properties, field), false, `sales must not accept ${field}`);
  }
  for (const field of ["salesContractId", "productDescription", "dischargeLocation"]) {
    assert.ok(sales.required.includes(field), `sales missing ${field}`);
    if (field !== "dischargeLocation") assert.equal(Object.hasOwn(supplier.properties, field), false, `supplier must not accept ${field}`);
  }
  for (const schema of [supplier, sales]) {
    for (const field of ["reference", "coffeeSpecificationId", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight", "origin", "loadLocation", "destination", "incoterm", "namedPlace", "containerNumbers", "sealNumbers", "transport"])
      assert.ok(schema.required.includes(field), `${field} must be required`);
    assert.equal(Object.hasOwn(schema.properties, "logistics"), false);
    assert.equal(schema.properties.containerNumbers.uniqueItems, true);
    assert.equal(schema.properties.sealNumbers.uniqueItems, true);
  }
});

test("immutable datasets keep aggregate identity outside while requiring shipment and invalidation linkage", () => {
  for (const name of ["SupplierShipmentDataset", "SalesShipmentDataset", "SupplierShipmentDatasetVersion", "SalesShipmentDatasetVersion"]) {
    const schema = schemas[name];
    assert.equal(schema.additionalProperties, false, `${name} must fail closed on injected fields`);
    assert.equal(Object.hasOwn(schema.properties, "reference"), false, `${name} must not duplicate aggregate reference`);
    assert.ok(schema.required.includes("shipmentId"));
    assert.ok(schema.required.includes("invalidatedApprovalIds"));
    assert.equal(schema.properties.shipmentId.$ref, UUID);
    assert.equal(schema.properties.invalidatedApprovalIds.uniqueItems, true);
    for (const field of ["datasetId", "revisionNo", "datasetVersion", "datasetHash", "state", "createdBy", "createdAt", "revisionReason"])
      assert.ok(schema.required.includes(field), `${name} missing ${field}`);
  }
  assert.equal(schemas.SupplierShipmentWorkspace.properties.reference.type, "string");
  assert.equal(schemas.SalesShipmentWorkspace.properties.reference.type, "string");
  assert.ok(schemas.SupplierShipmentWorkspace.required.includes("reference"));
  assert.ok(schemas.SalesShipmentWorkspace.required.includes("reference"));
});

test("dataset histories are shipment-bound and strictly declare ascending immutable revision order", () => {
  for (const [history, item] of [
    [schemas.SupplierShipmentDatasetHistory, "#/components/schemas/SupplierShipmentDatasetVersion"],
    [schemas.SalesShipmentDatasetHistory, "#/components/schemas/SalesShipmentDatasetVersion"],
  ]) {
    assert.equal(history.additionalProperties, false);
    assert.deepEqual(history.required, ["shipmentId", "order", "items"]);
    assert.equal(history.properties.shipmentId.$ref, UUID);
    assert.equal(history.properties.order.const, "revisionNo ASC");
    assert.equal(history.properties.items.items.$ref, item);
  }
});

test("primary source accepts exactly one supplier shipment and all writes enforce current-version controls", () => {
  const source = operation("/sales-shipments/{shipmentId}/primary-source", "put");
  const body = source.requestBody.content["application/json"].schema;
  assert.equal(body.additionalProperties, false);
  assert.deepEqual(body.required, ["supplierShipmentId"]);
  assert.deepEqual(Object.keys(body.properties), ["supplierShipmentId"]);
  assert.equal(body.properties.supplierShipmentId.$ref, UUID);
  for (const [path, method, idRef] of [
    ["/projects/{projectId}/supplier-shipments", "post", "ProjectId"],
    ["/projects/{projectId}/sales-shipments", "post", "ProjectId"],
    ["/sales-shipments/{shipmentId}/primary-source", "put", "ShipmentId"],
  ]) assert.deepEqual(parameterRefs(path, method), [
    `#/components/parameters/${idRef}`, "#/components/parameters/IfMatch", "#/components/parameters/IdempotencyKey", "#/components/parameters/CsrfToken",
  ]);
});

test("quantity summary keeps terminal quantities visible and separates remaining calculation fields", () => {
  const summary = schemas.QuantitySummary;
  assert.equal(summary.additionalProperties, false);
  assert.deepEqual(summary.required, ["contracted", "confirmed", "deliveredOrReceived", "cancelled", "rejected", "remaining"]);
  for (const field of summary.required) assert.equal(summary.properties[field].$ref, "#/components/schemas/Decimal");
});
