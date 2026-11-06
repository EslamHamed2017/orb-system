import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_A = "019a5f9b-7c00-7000-8000-000000000601";
const PROJECT_B = "019a5f9b-7c00-7000-8000-000000000602";
const PURCHASE_A = "019a5f9b-7c00-7000-8000-000000000611";
const PURCHASE_B = "019a5f9b-7c00-7000-8000-000000000612";
const SALES_A = "019a5f9b-7c00-7000-8000-000000000621";
const SUPPLIER = "019a5f9b-7c00-7000-8000-000000000631";
const COFFEE_A = "019a5f9b-7c00-7000-8000-000000000641";
const COFFEE_B = "019a5f9b-7c00-7000-8000-000000000642";
const ACTOR = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000650", displayName: "Operations", roles: ["OPERATIONS"] });

type ShipmentState = "DRAFT" | "CONFIRMED" | "IN_TRANSIT" | "RECEIVED" | "DELIVERED" | "CANCELLED" | "REJECTED";
interface SeedSupplierShipment { id: string; projectId: string; purchaseContractId: string; coffeeSpecificationId: string; quantity: string; executionState: ShipmentState }
interface ShipmentRepository {
  createSupplierShipment(input: Record<string, unknown>): Promise<any>;
  createSalesShipment(input: Record<string, unknown>): Promise<any>;
  setPrimarySupplierSource(input: Record<string, unknown>): Promise<any>;
  getSupplierWorkspace(id: string): Promise<any>;
  getSalesWorkspace(id: string): Promise<any>;
  listSupplierDatasetHistory(id: string): Promise<any>;
  listSalesDatasetHistory(id: string): Promise<any>;
}
interface ShipmentModule {
  createInMemoryShipmentRepository(options: {
    projects: readonly { id: string; version: number }[];
    contracts: readonly { id: string; projectId: string; kind: "PURCHASE" | "SALES"; state: "APPROVED"; coffeeSpecificationId: string; quantity: string; counterpartyId: string }[];
    supplierShipments?: readonly SeedSupplierShipment[];
    now: () => string;
  }): ShipmentRepository;
  readShipmentState(repository: ShipmentRepository): Readonly<{ supplierShipments: readonly any[]; salesShipments: readonly any[]; supplierDatasets: readonly any[]; salesDatasets: readonly any[] }>;
}
interface ShipmentQueryModule {
  calculateQuantitySummary(input: { contracted: string; shipments: readonly { quantity: string; executionState: ShipmentState }[]; kind: "SUPPLIER" | "SALES" }): Record<string, string>;
}
async function loadRepository(): Promise<ShipmentModule> {
  return import("../../../src/modules/shipments/shipment-repository.ts") as Promise<ShipmentModule>;
}
async function loadQuery(): Promise<ShipmentQueryModule> {
  return import("../../../src/modules/shipments/shipment-query.ts") as Promise<ShipmentQueryModule>;
}
function supplierDataset(overrides: Record<string, unknown> = {}) {
  return {
    reference: "SUP-A-001", purchaseContractId: PURCHASE_A, supplierId: SUPPLIER, coffeeSpecificationId: COFFEE_A,
    supplierLotReference: "LOT-001", quantity: "40.000000", bagCount: 800, bagWeight: "50.000000",
    netWeight: "40000.000000", grossWeight: "40400.000000", origin: { countryCode: "BR", location: "Santos" },
    loadLocation: { countryCode: "BR", location: "Santos Port" }, destination: { countryCode: "AE", location: "Jebel Ali" },
    incoterm: "FOB", namedPlace: "Santos", containerNumbers: ["CONT-001"], sealNumbers: ["SEAL-001"],
    transport: { mode: "SEA", carrier: "ORB Carrier", reference: "BL-001" }, ...overrides,
  };
}
function salesDataset(overrides: Record<string, unknown> = {}) {
  return {
    reference: "SALE-A-001", salesContractId: SALES_A, coffeeSpecificationId: COFFEE_A, productDescription: "Arabica green coffee",
    quantity: "20.000000", bagCount: 400, bagWeight: "50.000000", netWeight: "20000.000000", grossWeight: "20200.000000",
    origin: { countryCode: "BR", location: "Santos" }, loadLocation: { countryCode: "BR", location: "Santos Port" },
    dischargeLocation: { countryCode: "AE", location: "Jebel Ali Port" }, destination: { countryCode: "AE", location: "Dubai" },
    incoterm: "CIF", namedPlace: "Dubai", containerNumbers: ["CONT-001"], sealNumbers: ["SEAL-001"],
    transport: { mode: "SEA", carrier: "ORB Carrier", reference: "BL-001" }, ...overrides,
  };
}
function command(key: string) { return { principal: ACTOR, idempotencyKey: key, correlationId: key }; }
function isProblem(code: string) { return (error: unknown) => error instanceof ProblemError && error.problem.code === code; }
async function subject(supplierShipments: readonly SeedSupplierShipment[] = []) {
  const module = await loadRepository();
  const repository = module.createInMemoryShipmentRepository({
    projects: [{ id: PROJECT_A, version: 1 }, { id: PROJECT_B, version: 1 }],
    contracts: [
      { id: PURCHASE_A, projectId: PROJECT_A, kind: "PURCHASE", state: "APPROVED", coffeeSpecificationId: COFFEE_A, quantity: "100.000000", counterpartyId: SUPPLIER },
      { id: PURCHASE_B, projectId: PROJECT_B, kind: "PURCHASE", state: "APPROVED", coffeeSpecificationId: COFFEE_B, quantity: "100.000000", counterpartyId: SUPPLIER },
      { id: SALES_A, projectId: PROJECT_A, kind: "SALES", state: "APPROVED", coffeeSpecificationId: COFFEE_A, quantity: "100.000000", counterpartyId: "019a5f9b-7c00-7000-8000-000000000632" },
    ], supplierShipments, now: () => "2026-11-06T13:00:00.000Z",
  });
  return { module, repository };
}

test("supplier and sales creation persists distinct immutable dataset shapes with aggregate identity outside", async () => {
  const { module, repository } = await subject();
  const supplier = await repository.createSupplierShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: supplierDataset(), ...command("supplier-create-0001") });
  const sales = await repository.createSalesShipment({ projectId: PROJECT_A, expectedVersion: 2, dataset: salesDataset(), ...command("sales-create-0001") });
  assert.equal(supplier.value.reference, "SUP-A-001");
  assert.equal(sales.value.reference, "SALE-A-001");
  for (const workspace of [supplier.value, sales.value]) {
    assert.equal(workspace.activeDataset.shipmentId, workspace.id);
    assert.deepEqual(workspace.activeDataset.invalidatedApprovalIds, []);
    assert.equal(Object.hasOwn(workspace.activeDataset, "reference"), false);
    assert.match(workspace.activeDataset.datasetHash, /^[a-f0-9]{64}$/);
  }
  assert.equal(Object.hasOwn(supplier.value.activeDataset, "supplierId"), true);
  assert.equal(Object.hasOwn(supplier.value.activeDataset, "productDescription"), false);
  assert.equal(Object.hasOwn(sales.value.activeDataset, "productDescription"), true);
  assert.equal(Object.hasOwn(sales.value.activeDataset, "supplierId"), false);
  const state = module.readShipmentState(repository);
  assert.deepEqual([state.supplierShipments.length, state.supplierDatasets.length, state.salesShipments.length, state.salesDatasets.length], [1, 1, 1, 1]);
});

test("unknown fields and aggregate identity/linkage injection fail closed without persisting a shipment", async () => {
  const attacks = [
    { unknownField: "escape" }, { shipmentId: PROJECT_B }, { projectId: PROJECT_B }, { activeDatasetId: PROJECT_B },
    { primarySupplierShipmentId: PROJECT_B }, { primarySupplierShipmentIds: [PROJECT_B] }, { logistics: { arbitrary: true } },
  ];
  for (const [index, injected] of attacks.entries()) {
    const salesSubject = await subject();
    await assert.rejects(() => salesSubject.repository.createSalesShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: salesDataset(injected), ...command(`sales-injection-${index}`) }), isProblem("VALIDATION_FAILED"));
    assert.equal(salesSubject.module.readShipmentState(salesSubject.repository).salesShipments.length, 0);
    const supplierSubject = await subject();
    await assert.rejects(() => supplierSubject.repository.createSupplierShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: supplierDataset(injected), ...command(`supplier-injection-${index}`) }), isProblem("VALIDATION_FAILED"));
    assert.equal(supplierSubject.module.readShipmentState(supplierSubject.repository).supplierShipments.length, 0);
  }
});

test("primary source requires one confirmed shipment in the same Project with compatible coffee facts", async () => {
  const confirmedA = { id: "019a5f9b-7c00-7000-8000-000000000661", projectId: PROJECT_A, purchaseContractId: PURCHASE_A, coffeeSpecificationId: COFFEE_A, quantity: "40.000000", executionState: "CONFIRMED" as const };
  const draftA = { ...confirmedA, id: "019a5f9b-7c00-7000-8000-000000000662", executionState: "DRAFT" as const };
  const otherProject = { ...confirmedA, id: "019a5f9b-7c00-7000-8000-000000000663", projectId: PROJECT_B, purchaseContractId: PURCHASE_B, coffeeSpecificationId: COFFEE_B };
  const incompatible = { ...confirmedA, id: "019a5f9b-7c00-7000-8000-000000000664", coffeeSpecificationId: COFFEE_B };
  const { repository } = await subject([confirmedA, draftA, otherProject, incompatible]);
  const sales = (await repository.createSalesShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: salesDataset(), ...command("sales-source-create") })).value;
  for (const [source, code] of [[draftA.id, "PRIMARY_SOURCE_INVALID"], [otherProject.id, "PRIMARY_SOURCE_INVALID"], [incompatible.id, "PRIMARY_SOURCE_INVALID"]] as const)
    await assert.rejects(() => repository.setPrimarySupplierSource({ shipmentId: sales.id, supplierShipmentId: source, expectedVersion: sales.version, ...command(`source-${source}`) }), isProblem(code));
  await assert.rejects(() => repository.setPrimarySupplierSource({ shipmentId: sales.id, supplierShipmentId: confirmedA.id, supplierShipmentIds: [confirmedA.id, draftA.id], expectedVersion: sales.version, ...command("source-second-injection") }), isProblem("VALIDATION_FAILED"));
  const bound = await repository.setPrimarySupplierSource({ shipmentId: sales.id, supplierShipmentId: confirmedA.id, expectedVersion: sales.version, ...command("source-valid") });
  assert.equal(bound.value.primarySupplierShipmentId, confirmedA.id);
  assert.equal(Array.isArray(bound.value.primarySupplierShipmentIds), false, "Release 1 never exposes a second-source collection");
});

test("setting another primary source replaces the one binding and never creates source allocation", async () => {
  const first = { id: "019a5f9b-7c00-7000-8000-000000000665", projectId: PROJECT_A, purchaseContractId: PURCHASE_A, coffeeSpecificationId: COFFEE_A, quantity: "40.000000", executionState: "CONFIRMED" as const };
  const second = { ...first, id: "019a5f9b-7c00-7000-8000-000000000666" };
  const { module, repository } = await subject([first, second]);
  const sales = (await repository.createSalesShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: salesDataset(), ...command("sales-single-source") })).value;
  const once = (await repository.setPrimarySupplierSource({ shipmentId: sales.id, supplierShipmentId: first.id, expectedVersion: sales.version, ...command("source-first") })).value;
  const twice = (await repository.setPrimarySupplierSource({ shipmentId: sales.id, supplierShipmentId: second.id, expectedVersion: once.version, ...command("source-second") })).value;
  assert.equal(twice.primarySupplierShipmentId, second.id);
  const state = module.readShipmentState(repository);
  assert.equal(Object.hasOwn(state, "sourceAllocations"), false);
  assert.equal(state.salesShipments.length, 1);
});

test("workspaces and histories preserve shipment linkage, reference separation and ascending revisions", async () => {
  const { repository } = await subject();
  const supplier = (await repository.createSupplierShipment({ projectId: PROJECT_A, expectedVersion: 1, dataset: supplierDataset(), ...command("supplier-history") })).value;
  const sales = (await repository.createSalesShipment({ projectId: PROJECT_A, expectedVersion: 2, dataset: salesDataset(), ...command("sales-history") })).value;
  for (const [workspace, history] of [
    [await repository.getSupplierWorkspace(supplier.id), await repository.listSupplierDatasetHistory(supplier.id)],
    [await repository.getSalesWorkspace(sales.id), await repository.listSalesDatasetHistory(sales.id)],
  ]) {
    assert.equal(workspace.reference.length > 0, true);
    assert.equal(history.shipmentId, workspace.id);
    assert.equal(history.order, "revisionNo ASC");
    assert.deepEqual(history.items.map((row: any) => row.revisionNo), [1]);
    assert.equal(history.items[0].shipmentId, workspace.id);
    assert.equal(Object.hasOwn(history.items[0], "reference"), false);
    assert.deepEqual(history.items[0].invalidatedApprovalIds, []);
  }
});

test("cancelled and rejected quantities remain visible but are excluded from active remaining totals", async () => {
  const { calculateQuantitySummary } = await loadQuery();
  const summary = calculateQuantitySummary({
    contracted: "100.000000", kind: "SALES", shipments: [
      { quantity: "20.000000", executionState: "CONFIRMED" },
      { quantity: "30.000000", executionState: "DELIVERED" },
      { quantity: "10.000000", executionState: "CANCELLED" },
      { quantity: "5.000000", executionState: "REJECTED" },
    ],
  });
  assert.deepEqual(summary, {
    contracted: "100.000000", confirmed: "50.000000", deliveredOrReceived: "30.000000",
    cancelled: "10.000000", rejected: "5.000000", remaining: "50.000000",
  });
});
