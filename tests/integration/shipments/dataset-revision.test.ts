import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const ACTOR = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000801", displayName: "Operations", roles: ["OPERATIONS"] });
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000802";
const SUPPLIER_ID = "019a5f9b-7c00-7000-8000-000000000811";
const SALES_ID = "019a5f9b-7c00-7000-8000-000000000812";
const SUPPLIER_DATASET_ID = "019a5f9b-7c00-7000-8000-000000000821";
const SALES_DATASET_ID = "019a5f9b-7c00-7000-8000-000000000822";
const APPROVAL_ID = "019a5f9b-7c00-7000-8000-000000000831";
const EXCEPTION_ID = "019a5f9b-7c00-7000-8000-000000000832";
const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000841";
const PURCHASE_ID = "019a5f9b-7c00-7000-8000-000000000842";
const SALES_CONTRACT_ID = "019a5f9b-7c00-7000-8000-000000000843";
const SOURCE_ID = "019a5f9b-7c00-7000-8000-000000000844";

type ExecutionState = "DRAFT" | "CONFIRMED" | "IN_TRANSIT" | "RECEIVED" | "DELIVERED" | "CANCELLED" | "REJECTED";
type Kind = "SUPPLIER" | "SALES";
interface RevisionService {
  reviseSupplierDataset(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  reviseSalesDataset(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  getWorkspace(kind: Kind, shipmentId: string): Promise<any>;
  listHistory(kind: Kind, shipmentId: string): Promise<any>;
}
interface RevisionModule {
  createInMemoryShipmentRevisionService(options: Record<string, unknown>): RevisionService;
  readShipmentRevisionState(service: RevisionService): Readonly<{ shipments: readonly any[]; datasets: readonly any[]; approvals: readonly any[]; audit: readonly any[] }>;
}
async function loadModule(): Promise<RevisionModule> {
  return import("../../../src/modules/shipments/revision-service.ts") as Promise<RevisionModule>;
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status);
}
function command(key: string) { return { principal: ACTOR, idempotencyKey: key, correlationId: key }; }
function supplierFacts(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: "019a5f9b-7c00-7000-8000-000000000851", coffeeSpecificationId: "019a5f9b-7c00-7000-8000-000000000852",
    supplierLotReference: "LOT-REV-2", quantity: "41.000000", bagCount: 820, bagWeight: "50.000000",
    netWeight: "41000.000000", grossWeight: "41410.000000", origin: { countryCode: "BR", location: "Santos" },
    loadLocation: { countryCode: "BR", location: "Santos Port" }, destination: { countryCode: "AE", location: "Jebel Ali" },
    incoterm: "FOB", namedPlace: "Santos", containerNumbers: ["CONT-REV-2"], sealNumbers: ["SEAL-REV-2"],
    transport: { mode: "SEA", carrier: "ORB Carrier", reference: "BL-REV-2" }, ...overrides,
  };
}
function salesFacts(overrides: Record<string, unknown> = {}) {
  return {
    coffeeSpecificationId: "019a5f9b-7c00-7000-8000-000000000852", productDescription: "Arabica green coffee revised",
    quantity: "21.000000", bagCount: 420, bagWeight: "50.000000", netWeight: "21000.000000", grossWeight: "21210.000000",
    origin: { countryCode: "BR", location: "Santos" }, loadLocation: { countryCode: "BR", location: "Santos Port" },
    dischargeLocation: { countryCode: "AE", location: "Jebel Ali Port" }, destination: { countryCode: "AE", location: "Dubai" },
    incoterm: "CIF", namedPlace: "Dubai", containerNumbers: ["CONT-SALE-REV-2"], sealNumbers: ["SEAL-SALE-REV-2"],
    transport: { mode: "SEA", carrier: "ORB Carrier", reference: "BL-SALE-REV-2" }, ...overrides,
  };
}
async function subject(state: ExecutionState = "CONFIRMED") {
  const module = await loadModule();
  const service = module.createInMemoryShipmentRevisionService({
    now: () => "2026-11-06T15:00:00.000Z",
    shipments: [
      { id: SUPPLIER_ID, kind: "SUPPLIER", projectId: PROJECT_ID, contractId: PURCHASE_ID, reference: "SUP-001", primarySupplierShipmentId: null, version: 4, executionState: state, activeDatasetId: SUPPLIER_DATASET_ID },
      { id: SALES_ID, kind: "SALES", projectId: PROJECT_ID, contractId: SALES_CONTRACT_ID, reference: "SALE-001", primarySupplierShipmentId: SOURCE_ID, version: 7, executionState: state, activeDatasetId: SALES_DATASET_ID },
    ],
    datasets: [
      { datasetId: SUPPLIER_DATASET_ID, shipmentId: SUPPLIER_ID, kind: "SUPPLIER", revisionNo: 1, datasetVersion: 1, datasetHash: "a".repeat(64), state: "APPROVED", approvalId: APPROVAL_ID, invalidatedApprovalIds: [], facts: supplierFacts({ quantity: "40.000000" }), createdBy: ACTOR, createdAt: "2026-11-06T14:00:00.000Z", revisionReason: "Initial dataset" },
      { datasetId: SALES_DATASET_ID, shipmentId: SALES_ID, kind: "SALES", revisionNo: 1, datasetVersion: 1, datasetHash: "b".repeat(64), state: "APPROVED", approvalId: APPROVAL_ID, invalidatedApprovalIds: [], facts: salesFacts({ quantity: "20.000000" }), createdBy: ACTOR, createdAt: "2026-11-06T14:00:00.000Z", revisionReason: "Initial dataset" },
    ],
    approvals: [
      { id: APPROVAL_ID, subjectId: SALES_DATASET_ID, type: "CONFIRMATION", state: "APPROVED" },
      { id: EXCEPTION_ID, subjectId: SALES_DATASET_ID, type: "TOLERANCE_EXCEPTION", state: "APPROVED" },
    ],
  });
  return { module, service };
}

test("eligible supplier and sales revisions append immutable superseding datasets and preserve aggregate identity", async () => {
  const { module, service } = await subject("DRAFT");
  const before = structuredClone(module.readShipmentRevisionState(service));
  const supplier = await service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: "Correct supplier packing facts", evidenceId: EVIDENCE_ID, ...command("supplier-revision-0001") });
  const sales = await service.reviseSalesDataset({ shipmentId: SALES_ID, expectedVersion: 7, dataset: salesFacts(), changeReason: "Correct sales packing facts", ...command("sales-revision-0001") });
  for (const [result, id, reference, contractId] of [[supplier.value, SUPPLIER_ID, "SUP-001", PURCHASE_ID], [sales.value, SALES_ID, "SALE-001", SALES_CONTRACT_ID]] as const) {
    assert.equal(result.id, id); assert.equal(result.reference, reference); assert.equal(result.projectId, PROJECT_ID); assert.equal(result.contractId, contractId);
    assert.equal(result.activeDataset.revisionNo, 2); assert.equal(result.activeDataset.datasetVersion, 2); assert.match(result.activeDataset.datasetHash, /^[a-f0-9]{64}$/);
    assert.equal(result.activeDataset.shipmentId, id); assert.equal(result.activeDataset.state, "DRAFT"); assert.equal(result.activeDataset.createdBy.userId, ACTOR.userId);
  }
  assert.equal(supplier.value.activeDataset.revisionReason, "Correct supplier packing facts");
  assert.equal(supplier.value.activeDataset.evidenceId, EVIDENCE_ID);
  const after = module.readShipmentRevisionState(service);
  assert.equal(after.datasets.length, before.datasets.length + 2);
  assert.deepEqual(after.datasets.slice(0, before.datasets.length), before.datasets, "old history rows must remain byte-for-byte unchanged");
  assert.equal(after.datasets[0].state, "APPROVED", "supersession is represented by the new row, never mutation of history");
});

test("revision expires every dataset-bound approval/exception, records invalidation, and resets CONFIRMED to DRAFT", async () => {
  const { module, service } = await subject("CONFIRMED");
  const revised = await service.reviseSalesDataset({ shipmentId: SALES_ID, expectedVersion: 7, dataset: salesFacts(), changeReason: "Correct confirmed shipment", evidenceId: EVIDENCE_ID, ...command("sales-revision-reset") });
  assert.equal(revised.value.executionState, "DRAFT");
  assert.equal(revised.value.confirmationApprovalId, null);
  assert.equal(revised.value.toleranceExceptionApprovalId, null);
  assert.deepEqual([...revised.value.activeDataset.invalidatedApprovalIds].sort(), [APPROVAL_ID, EXCEPTION_ID].sort());
  const state = module.readShipmentRevisionState(service);
  assert.deepEqual(state.approvals.map((row) => [row.id, row.state]).sort(), [[APPROVAL_ID, "EXPIRED"], [EXCEPTION_ID, "EXPIRED"]].sort());
  assert.equal(state.audit.at(-1)?.action, "SALES_SHIPMENT_DATASET_REVISED");
});

test("revision payload is dataset-facts-only and rejects identity, linkage, reference, source and unknown injection", async () => {
  const attacks = [
    { reference: "HIJACK" }, { shipmentId: SUPPLIER_ID }, { projectId: PROJECT_ID }, { contractId: PURCHASE_ID },
    { purchaseContractId: PURCHASE_ID }, { salesContractId: SALES_CONTRACT_ID }, { primarySupplierShipmentId: SOURCE_ID },
    { supplierShipmentId: SOURCE_ID }, { activeDatasetId: SALES_DATASET_ID }, { unknownField: "escape" },
  ];
  for (const [index, attack] of attacks.entries()) {
    const { module, service } = await subject("DRAFT"); const before = module.readShipmentRevisionState(service);
    await assert.rejects(() => service.reviseSalesDataset({ shipmentId: SALES_ID, expectedVersion: 7, dataset: salesFacts(attack), changeReason: "Attempt identity injection", ...command(`revision-injection-${index}`) }), isProblem("VALIDATION_FAILED", 400));
    assert.deepEqual(module.readShipmentRevisionState(service), before);
  }
  const { service } = await subject("DRAFT");
  await assert.rejects(() => service.reviseSalesDataset({ shipmentId: SALES_ID, expectedVersion: 7, dataset: salesFacts(), changeReason: "Valid reason", unexpected: true, ...command("revision-command-injection") }), isProblem("VALIDATION_FAILED", 400));
});

test("revision rejects IN_TRANSIT and every terminal state without changing history", async () => {
  for (const state of ["IN_TRANSIT", "RECEIVED", "DELIVERED", "CANCELLED", "REJECTED"] as const) {
    const { module, service } = await subject(state); const before = module.readShipmentRevisionState(service);
    await assert.rejects(() => service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: "Forbidden post-transit correction", ...command(`post-transit-${state}`) }), isProblem("INVALID_STATE_TRANSITION", 409));
    assert.deepEqual(module.readShipmentRevisionState(service), before);
  }
});

test("revision rejects stale versions and invalid reason/evidence and replays the exact command without a second row", async () => {
  const { module, service } = await subject("DRAFT");
  await assert.rejects(() => service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 3, dataset: supplierFacts(), changeReason: "Stale", ...command("revision-stale") }), isProblem("STALE_VERSION", 412));
  await assert.rejects(() => service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: " ", ...command("revision-empty-reason") }), isProblem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: "Bad evidence", evidenceId: "not-a-uuid", ...command("revision-bad-evidence") }), isProblem("VALIDATION_FAILED", 400));
  const input = { shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: "Correct packing facts", evidenceId: EVIDENCE_ID, ...command("revision-replay") };
  const first = await service.reviseSupplierDataset(input); const replay = await service.reviseSupplierDataset(input);
  assert.equal(replay.replayed, true); assert.deepEqual(replay.value, first.value);
  assert.equal(module.readShipmentRevisionState(service).datasets.filter((row) => row.shipmentId === SUPPLIER_ID).length, 2);
  await assert.rejects(() => service.reviseSupplierDataset({ ...input, changeReason: "Different payload" }), isProblem("IDEMPOTENCY_KEY_REUSED", 409));
});

test("history stays ascending and exposes immutable revision reasons, actor/time, evidence and approval invalidation", async () => {
  const { service } = await subject("CONFIRMED");
  await service.reviseSupplierDataset({ shipmentId: SUPPLIER_ID, expectedVersion: 4, dataset: supplierFacts(), changeReason: "Correct source weights", evidenceId: EVIDENCE_ID, ...command("revision-history") });
  const history = await service.listHistory("SUPPLIER", SUPPLIER_ID);
  assert.equal(history.order, "revisionNo ASC"); assert.deepEqual(history.items.map((row: any) => row.revisionNo), [1, 2]);
  assert.equal(history.items[1].revisionReason, "Correct source weights"); assert.equal(history.items[1].createdAt, "2026-11-06T15:00:00.000Z");
  assert.equal(history.items[1].createdBy.userId, ACTOR.userId); assert.equal(history.items[1].evidenceId, EVIDENCE_ID);
  assert.ok(Object.isFrozen(history.items[0]) && Object.isFrozen(history.items[1]));
});
