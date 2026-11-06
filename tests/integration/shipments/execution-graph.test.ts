import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const ACTOR = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000901", displayName: "Operations", roles: ["OPERATIONS"] });
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000902";
const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000000903";
const DATASET_ID = "019a5f9b-7c00-7000-8000-000000000904";
type Kind = "SUPPLIER" | "SALES";
type SupplierState = "DRAFT" | "CONFIRMED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED" | "REJECTED";
type SalesState = "DRAFT" | "CONFIRMED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REJECTED";
interface ExecutionService {
  transitionSupplier(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  transitionSales(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
}
interface ExecutionModule {
  createInMemoryShipmentExecutionService(options: Record<string, unknown>): ExecutionService;
  readShipmentExecutionState(service: ExecutionService): Readonly<{ shipments: readonly any[]; events: readonly any[]; audit: readonly any[] }>;
}
async function loadModule(): Promise<ExecutionModule> {
  return import("../../../src/modules/shipments/execution-service.ts") as Promise<ExecutionModule>;
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status);
}
function command(key: string) { return { principal: ACTOR, idempotencyKey: key, correlationId: key }; }
async function subject(kind: Kind, state: SupplierState | SalesState, version = 3) {
  const module = await loadModule();
  const service = module.createInMemoryShipmentExecutionService({
    now: () => "2026-11-06T16:00:00.000Z",
    shipments: [{ id: SHIPMENT_ID, kind, version, executionState: state, activeDatasetId: DATASET_ID }],
  });
  return { module, service };
}
const LEGAL_SUPPLIER: readonly [SupplierState, SupplierState][] = [
  ["DRAFT", "CANCELLED"], ["CONFIRMED", "IN_TRANSIT"], ["CONFIRMED", "CANCELLED"], ["CONFIRMED", "REJECTED"],
  ["IN_TRANSIT", "RECEIVED"], ["IN_TRANSIT", "REJECTED"],
];
const LEGAL_SALES: readonly [SalesState, SalesState][] = [
  ["DRAFT", "CANCELLED"], ["CONFIRMED", "IN_TRANSIT"], ["CONFIRMED", "CANCELLED"], ["CONFIRMED", "REJECTED"],
  ["IN_TRANSIT", "DELIVERED"], ["IN_TRANSIT", "REJECTED"],
];
const SUPPLIER_STATES: readonly SupplierState[] = ["DRAFT", "CONFIRMED", "IN_TRANSIT", "RECEIVED", "CANCELLED", "REJECTED"];
const SALES_STATES: readonly SalesState[] = ["DRAFT", "CONFIRMED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"];

test("every declared supplier and sales execution edge appends one complete immutable event", async () => {
  for (const [kind, edges] of [["SUPPLIER", LEGAL_SUPPLIER], ["SALES", LEGAL_SALES]] as const) {
    for (const [from, to] of edges) {
      const { module, service } = await subject(kind, from);
      const transition = kind === "SUPPLIER" ? service.transitionSupplier.bind(service) : service.transitionSales.bind(service);
      const result = await transition({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: to, reason: `Move ${from} to ${to}`, evidenceId: EVIDENCE_ID, ...command(`legal-${kind}-${from}-${to}`) });
      assert.equal(result.value.executionState, to); assert.equal(result.value.version, 4);
      const state = module.readShipmentExecutionState(service); assert.equal(state.events.length, 1);
      assert.deepEqual({ shipmentType: state.events[0].shipmentType, shipmentId: state.events[0].shipmentId, fromState: state.events[0].fromState, toState: state.events[0].toState, datasetId: state.events[0].datasetId, occurredAt: state.events[0].occurredAt, reason: state.events[0].reason, evidenceId: state.events[0].evidenceId, actorId: state.events[0].actorId, aggregateVersion: state.events[0].aggregateVersion, idempotencyKey: state.events[0].idempotencyKey }, {
        shipmentType: kind, shipmentId: SHIPMENT_ID, fromState: from, toState: to, datasetId: DATASET_ID,
        occurredAt: "2026-11-06T16:00:00.000Z", reason: `Move ${from} to ${to}`, evidenceId: EVIDENCE_ID,
        actorId: ACTOR.userId, aggregateVersion: 4, idempotencyKey: `legal-${kind}-${from}-${to}`,
      });
      assert.ok(Object.isFrozen(state.events[0])); assert.equal(state.audit.length, 1);
    }
  }
});

test("every undeclared supplier graph edge is rejected without an event", async () => {
  const legal = new Set(LEGAL_SUPPLIER.map(([from, to]) => `${from}->${to}`));
  for (const from of SUPPLIER_STATES) for (const to of SUPPLIER_STATES) {
    if (legal.has(`${from}->${to}`)) continue;
    const { module, service } = await subject("SUPPLIER", from); const before = module.readShipmentExecutionState(service);
    await assert.rejects(() => service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: to, reason: "Forbidden supplier edge", ...command(`illegal-supplier-${from}-${to}`) }), isProblem("INVALID_STATE_TRANSITION", 409));
    assert.deepEqual(module.readShipmentExecutionState(service), before, `${from}->${to} must not mutate state`);
  }
});

test("every undeclared sales graph edge is rejected without an event", async () => {
  const legal = new Set(LEGAL_SALES.map(([from, to]) => `${from}->${to}`));
  for (const from of SALES_STATES) for (const to of SALES_STATES) {
    if (legal.has(`${from}->${to}`)) continue;
    const { module, service } = await subject("SALES", from); const before = module.readShipmentExecutionState(service);
    await assert.rejects(() => service.transitionSales({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: to, reason: "Forbidden sales edge", ...command(`illegal-sales-${from}-${to}`) }), isProblem("INVALID_STATE_TRANSITION", 409));
    assert.deepEqual(module.readShipmentExecutionState(service), before, `${from}->${to} must not mutate state`);
  }
});

test("execution transitions fail closed on unknown target, cross-kind identity, strict payload, empty reason and bad evidence", async () => {
  const { module, service } = await subject("SUPPLIER", "CONFIRMED"); const before = module.readShipmentExecutionState(service);
  await assert.rejects(() => service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "DELIVERED", reason: "Wrong graph target", ...command("supplier-unknown-target") }), isProblem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.transitionSales({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: "Wrong aggregate kind", ...command("cross-kind") }), isProblem("RESOURCE_NOT_FOUND", 404));
  await assert.rejects(() => service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: " ", ...command("empty-reason") }), isProblem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: "Bad evidence", evidenceId: "not-a-uuid", ...command("bad-evidence") }), isProblem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: "Unknown payload", extra: true, ...command("unknown-payload") }), isProblem("VALIDATION_FAILED", 400));
  assert.deepEqual(module.readShipmentExecutionState(service), before);
});

test("stale versions and changed replays fail while exact replay appends no duplicate event", async () => {
  const { module, service } = await subject("SALES", "CONFIRMED");
  await assert.rejects(() => service.transitionSales({ shipmentId: SHIPMENT_ID, expectedVersion: 2, toState: "IN_TRANSIT", reason: "Stale", ...command("transition-stale") }), isProblem("STALE_VERSION", 412));
  const input = { shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: "Carrier departed", evidenceId: EVIDENCE_ID, ...command("transition-replay") };
  const first = await service.transitionSales(input); const replay = await service.transitionSales(input);
  assert.equal(replay.replayed, true); assert.deepEqual(replay.value, first.value); assert.equal(module.readShipmentExecutionState(service).events.length, 1);
  await assert.rejects(() => service.transitionSales({ ...input, reason: "Changed reason" }), isProblem("IDEMPOTENCY_KEY_REUSED", 409));
  assert.equal(module.readShipmentExecutionState(service).events.length, 1);
});

test("sequential transitions preserve prior event rows and monotonically bind aggregate versions", async () => {
  const { module, service } = await subject("SUPPLIER", "CONFIRMED");
  await service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 3, toState: "IN_TRANSIT", reason: "Departed", ...command("sequence-departed") });
  const firstSnapshot = structuredClone(module.readShipmentExecutionState(service).events[0]);
  await service.transitionSupplier({ shipmentId: SHIPMENT_ID, expectedVersion: 4, toState: "RECEIVED", reason: "Warehouse receipt", evidenceId: EVIDENCE_ID, ...command("sequence-received") });
  const state = module.readShipmentExecutionState(service);
  assert.equal(state.events.length, 2); assert.deepEqual(state.events[0], firstSnapshot);
  assert.deepEqual(state.events.map((event) => event.aggregateVersion), [4, 5]);
  assert.deepEqual(state.events.map((event) => [event.fromState, event.toState]), [["CONFIRMED", "IN_TRANSIT"], ["IN_TRANSIT", "RECEIVED"]]);
});
