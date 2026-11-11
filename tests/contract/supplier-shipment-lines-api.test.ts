import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";
import { createSupplierShipmentLineService, type SupplierShipmentLineRepository } from "../../src/modules/shipments/supplier-shipment-line-service.ts";

const id = {
  shipment: "019a5f9b-7c00-7000-8000-000000000201",
  dataset: "019a5f9b-7c00-7000-8000-000000000202",
  contract: "019a5f9b-7c00-7000-8000-000000000203",
  supplier: "019a5f9b-7c00-7000-8000-000000000204",
  lineVersion: "019a5f9b-7c00-7000-8000-000000000205",
  otherLineVersion: "019a5f9b-7c00-7000-8000-000000000206",
  line: "019a5f9b-7c00-7000-8000-000000000207",
};
const facts = { contractLineVersionId: id.lineVersion, supplierLotReference: "LOT-42", quantity: "25.500000", bagCount: 425, bagWeight: "0.060000", netWeight: "25.500000", grossWeight: "25.900000" };

function repository(): SupplierShipmentLineRepository & { rows: any[] } {
  const rows: any[] = [];
  return {
    rows,
    async getDataset(shipmentId, datasetId) { return shipmentId === id.shipment && datasetId === id.dataset ? { id: id.dataset, shipmentId: id.shipment, purchaseContractId: id.contract, supplierId: id.supplier, state: "DRAFT" } : null; },
    async getApprovedPurchaseContractLineVersion(versionId, contractId, supplierId) { return versionId === id.lineVersion && contractId === id.contract && supplierId === id.supplier ? { id: id.lineVersion, contractId: id.contract, counterpartyId: id.supplier, contractKind: "PURCHASE", quantity: "100.000000", unitPrice: "5.000000", approvalState: "APPROVED" } : null; },
    async nextLineNo() { return rows.length + 1; },
    async findByContractLineVersion(datasetId, versionId) { return rows.find((row) => row.supplierShipmentDatasetId === datasetId && row.contractLineVersionId === versionId) ?? null; },
    async insert(input) { rows.push(input); return input; },
    async list(datasetId) { return rows.filter((row) => row.supplierShipmentDatasetId === datasetId); },
    async get(datasetId, lineId) { return rows.find((row) => row.supplierShipmentDatasetId === datasetId && row.id === lineId) ?? null; },
  };
}

test("supplier shipment line creation binds facts to the exact approved purchase-contract line and supplier", async () => {
  const repo = repository();
  const service = createSupplierShipmentLineService({ repository: repo, newId: () => id.line });
  const created = await service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "create-supplier-line" });
  assert.equal(created.purchaseContractId, id.contract);
  assert.equal(created.supplierId, id.supplier);
  assert.equal(created.contractLineVersionId, id.lineVersion);
  assert.equal(created.lineNo, 1);
  assert.equal(created.hashVersion, 2);
  assert.match(created.lineHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(created), true);
  assert.deepEqual(await service.list({ shipmentId: id.shipment, datasetId: id.dataset, correlationId: "list" }), [created]);
  assert.equal(await service.get({ shipmentId: id.shipment, datasetId: id.dataset, lineId: id.line, correlationId: "get" }), created);
});

test("supplier shipment lines reject arbitrary, sales, cross-contract, cross-supplier, unapproved, duplicate and immutable writes", async () => {
  const repo = repository();
  const service = createSupplierShipmentLineService({ repository: repo, newId: () => id.line });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: { ...facts, contractLineVersionId: id.otherLineVersion }, correlationId: "arbitrary" }), (error: any) => error.problem?.code === "APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED");
  const valid = { id: id.lineVersion, contractId: id.contract, counterpartyId: id.supplier, contractKind: "PURCHASE", quantity: "100", unitPrice: "5", approvalState: "APPROVED" };
  for (const override of [{ contractKind: "SALES" }, { contractId: "019a5f9b-7c00-7000-8000-000000000999" }, { counterpartyId: "019a5f9b-7c00-7000-8000-000000000998" }, { approvalState: "PENDING_APPROVAL" }]) {
    repo.getApprovedPurchaseContractLineVersion = async () => ({ ...valid, ...override });
    await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "wrong-source" }), (error: any) => error.problem?.code === "APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED");
  }
  repo.getApprovedPurchaseContractLineVersion = async () => valid;
  await service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "first" });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts, correlationId: "duplicate" }), (error: any) => error.problem?.code === "SHIPMENT_CONTRACT_LINE_DUPLICATE");
  repo.getDataset = async () => ({ id: id.dataset, shipmentId: id.shipment, purchaseContractId: id.contract, supplierId: id.supplier, state: "APPROVED" });
  await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: { ...facts, contractLineVersionId: id.otherLineVersion }, correlationId: "immutable" }), (error: any) => error.problem?.code === "IMMUTABLE_VERSION");
});

test("supplier shipment line facts fail closed", async () => {
  const service = createSupplierShipmentLineService({ repository: repository() });
  for (const invalid of [{ ...facts, quantity: "0" }, { ...facts, bagCount: 0 }, { ...facts, supplierLotReference: "" }, { ...facts, surprise: true }]) {
    await assert.rejects(() => service.create({ shipmentId: id.shipment, datasetId: id.dataset, facts: invalid, correlationId: "invalid" }), (error: any) => error.problem?.code === "VALIDATION_FAILED");
  }
});

test("supplier shipment line routes authorize reads and mutations before dependencies", async () => {
  const route = await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/lines/route.ts");
  let called = false;
  const post = route.createPostHandler({ authenticate: async () => ({ userId: id.line, roles: ["FINANCE_VIEWER"] }), create: async () => { called = true; return {}; } });
  const denied = await post(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: id.shipment, datasetId: id.dataset }) });
  assert.equal(denied.status, 403);
  assert.equal(called, false);
  const get = route.createGetHandler({ authenticate: async () => ({ userId: id.line, roles: ["FINANCE_VIEWER"] }), list: async (input) => { called = true; return [input.datasetId]; } });
  const allowed = await get(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId: id.shipment, datasetId: id.dataset }) });
  assert.equal(allowed.status, 200);
  assert.deepEqual((await allowed.json()).items, [id.dataset]);
  assert.equal(called, true);
});

test("supplier shipment line OpenAPI contracts list/create/get and exact approved-line input", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const collection = api.paths["/supplier-shipments/{shipmentId}/datasets/{datasetId}/lines"];
  const item = api.paths["/supplier-shipments/{shipmentId}/datasets/{datasetId}/lines/{lineId}"];
  assert.equal(collection.get.operationId, "listSupplierShipmentLines");
  assert.equal(collection.post.operationId, "createSupplierShipmentLine");
  assert.equal(item.get.operationId, "getSupplierShipmentLine");
  assert.deepEqual(collection.post.parameters.slice(-3).map((parameter: any) => parameter.$ref), ["#/components/parameters/IfMatch", "#/components/parameters/IdempotencyKey", "#/components/parameters/CsrfToken"]);
  assert.deepEqual(api.components.schemas.SupplierShipmentLineInput.required, ["contractLineVersionId", "supplierLotReference", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight"]);
  assert.equal(api.components.schemas.SupplierShipmentLineInput.additionalProperties, false);
});
