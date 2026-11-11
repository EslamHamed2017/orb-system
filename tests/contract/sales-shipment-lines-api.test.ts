import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";
import { createSalesShipmentLineService, type SalesShipmentLineRepository } from "../../src/modules/shipments/sales-shipment-line-service.ts";

const id = {
  shipment: "019a5f9b-7c00-7000-8000-000000000101",
  dataset: "019a5f9b-7c00-7000-8000-000000000102",
  contract: "019a5f9b-7c00-7000-8000-000000000103",
  lineVersion: "019a5f9b-7c00-7000-8000-000000000104",
  otherLineVersion: "019a5f9b-7c00-7000-8000-000000000105",
  line: "019a5f9b-7c00-7000-8000-000000000106",
  product: "019a5f9b-7c00-7000-8000-000000000107",
};
const facts = { contractLineVersionId: id.lineVersion, productDescription: "Ethiopia washed coffee", customerPurchaseOrderReference: "PO-42", marksAndNumbers: null, quantity: "25.500000", bagCount: 425, bagWeight: "0.060000", netWeight: "25.500000", grossWeight: "25.900000" };

function repository(): SalesShipmentLineRepository & { rows: any[] } {
  const rows: any[] = [];
  return {
    rows,
    async getDataset(shipmentId, datasetId) { return shipmentId === id.shipment && datasetId === id.dataset ? { id: id.dataset, shipmentId: id.shipment, salesContractId: id.contract, state: "DRAFT" } : null; },
    async getApprovedContractLineVersion(versionId, contractId) { return versionId === id.lineVersion && contractId === id.contract ? { id: id.lineVersion, contractId: id.contract, coffeeSpecificationId: id.product, quantity: "100.000000", unitPrice: "5.000000", approvalState: "APPROVED" } : null; },
    async nextLineNo() { return rows.length + 1; },
    async findByContractLineVersion(datasetId, versionId) { return rows.find((row) => row.salesShipmentDatasetId === datasetId && row.contractLineVersionId === versionId) ?? null; },
    async insert(input) { rows.push(input); return input; },
    async list(datasetId) { return rows.filter((row) => row.salesShipmentDatasetId === datasetId); },
    async get(datasetId, lineId) { return rows.find((row) => row.salesShipmentDatasetId === datasetId && row.id === lineId) ?? null; },
  };
}

test("sales shipment line creation binds immutable facts to the exact approved contract-line version", async () => {
  const repo = repository();
  const service = createSalesShipmentLineService({ repository: repo, newId: () => id.line });
  const created = await service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "create-sales-line" });
  assert.equal(created.salesContractId, id.contract);
  assert.equal(created.contractLineVersionId, id.lineVersion);
  assert.equal(created.coffeeSpecificationId, id.product);
  assert.equal(created.lineNo, 1);
  assert.equal(created.hashVersion, 2);
  assert.match(created.lineHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(created), true);
  assert.deepEqual(await service.list({ shipmentId: id.shipment, datasetId: id.dataset, correlationId: "list" }), [created]);
  assert.equal(await service.get({ shipmentId: id.shipment, datasetId: id.dataset, lineId: id.line, correlationId: "get" }), created);
});

test("sales shipment lines reject arbitrary, cross-contract, unapproved, duplicate, and immutable-dataset writes", async () => {
  const repo = repository();
  const service = createSalesShipmentLineService({ repository: repo, newId: () => id.line });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: { ...facts, contractLineVersionId: id.otherLineVersion }, correlationId: "arbitrary" }), (error: any) => error.problem?.code === "APPROVED_CONTRACT_LINE_REQUIRED");
  repo.getApprovedContractLineVersion = async () => ({ id: id.lineVersion, contractId: "019a5f9b-7c00-7000-8000-000000000999", coffeeSpecificationId: id.product, quantity: "100", unitPrice: "5", approvalState: "APPROVED" });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "cross-contract" }), (error: any) => error.problem?.code === "APPROVED_CONTRACT_LINE_REQUIRED");
  repo.getApprovedContractLineVersion = async () => ({ id: id.lineVersion, contractId: id.contract, coffeeSpecificationId: id.product, quantity: "100", unitPrice: "5", approvalState: "APPROVED" });
  await service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "first" });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "duplicate" }), (error: any) => error.problem?.code === "SHIPMENT_CONTRACT_LINE_DUPLICATE");
  repo.getDataset = async () => ({ id: id.dataset, shipmentId: id.shipment, salesContractId: id.contract, state: "APPROVED" });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: { ...facts, contractLineVersionId: id.otherLineVersion }, correlationId: "immutable" }), (error: any) => error.problem?.code === "IMMUTABLE_VERSION");
});

test("sales shipment line facts fail closed on invalid quantities and unknown fields", async () => {
  const service = createSalesShipmentLineService({ repository: repository() });
  for (const invalid of [{ ...facts, quantity: "0" }, { ...facts, bagCount: 0 }, { ...facts, surprise: true }]) {
    await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: invalid, correlationId: "invalid" }), (error: any) => error.problem?.code === "VALIDATION_FAILED");
  }
});

test("sales shipment line routes authorize reads and mutations before dependencies", async () => {
  const route = await import("../../src/app/api/sales-shipments/[shipmentId]/datasets/[datasetId]/lines/route.ts");
  let called = false;
  const post = route.createPostHandler({ authenticate: async () => ({ userId: id.line, roles: ["FINANCE_VIEWER"] }), create: async () => { called = true; return {}; } });
  const denied = await post(new Request("https://orb.example/api/sales-shipments/x/datasets/y/lines", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: id.shipment, datasetId: id.dataset }) });
  assert.equal(denied.status, 403);
  assert.equal(called, false);
  const get = route.createGetHandler({ authenticate: async () => ({ userId: id.line, roles: ["FINANCE_VIEWER"] }), list: async (input) => { called = true; return [input.datasetId]; } });
  const allowed = await get(new Request("https://orb.example/api/sales-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId: id.shipment, datasetId: id.dataset }) });
  assert.equal(allowed.status, 200);
  assert.deepEqual((await allowed.json()).items, [id.dataset]);
  assert.equal(called, true);
});


test("sales shipment line OpenAPI contracts list/create/get and exact approved-line input", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const collection = api.paths["/sales-shipments/{shipmentId}/datasets/{datasetId}/lines"];
  const item = api.paths["/sales-shipments/{shipmentId}/datasets/{datasetId}/lines/{lineId}"];
  assert.equal(collection.get.operationId, "listSalesShipmentLines");
  assert.equal(collection.post.operationId, "createSalesShipmentLine");
  assert.equal(item.get.operationId, "getSalesShipmentLine");
  assert.deepEqual(collection.post.parameters.slice(-3).map((parameter: any) => parameter.$ref), ["#/components/parameters/IfMatch", "#/components/parameters/IdempotencyKey", "#/components/parameters/CsrfToken"]);
  assert.deepEqual(api.components.schemas.SalesShipmentLineInput.required, ["contractLineVersionId", "productDescription", "customerPurchaseOrderReference", "marksAndNumbers", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight"]);
  assert.equal(api.components.schemas.SalesShipmentLineInput.additionalProperties, false);
});
