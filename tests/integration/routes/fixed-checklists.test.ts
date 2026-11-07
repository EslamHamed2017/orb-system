import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000000801";
const ACTOR = Object.freeze({
  userId: "019a5f9b-7c00-7000-8000-000000000802",
  displayName: "Operations",
  roles: ["OPERATIONS"],
});
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000803";

type TradeRoute = "FOREIGN_TO_FOREIGN" | "UAE_FREE_ZONE_REEXPORT" | "UAE_IMPORT";
type RouteItemState = "NOT_STARTED" | "IN_PROGRESS" | "SATISFIED" | "NOT_APPLICABLE_BY_RULE";
type RouteItem = Readonly<{
  id: string;
  code: string;
  label: string;
  kind: "FACT" | "EVIDENCE" | "MILESTONE";
  required: boolean;
  state: RouteItemState;
  applicabilityRule: string | null;
  evidenceId: string | null;
  milestoneAt: string | null;
}>;
type Checklist = Readonly<{
  shipmentId: string;
  route: TradeRoute;
  templateVersion: number;
  version: number;
  items: readonly RouteItem[];
  closureComplete: boolean;
}>;
type Command = Readonly<{
  shipmentId: string;
  itemId: string;
  expectedVersion: number;
  idempotencyKey: string;
  correlationId: string;
  principal: typeof ACTOR;
  state: "IN_PROGRESS" | "SATISFIED";
  evidenceId?: string;
  milestoneAt?: string;
}>;
interface RouteService {
  snapshotChecklist(input: {
    shipmentId: string;
    route: TradeRoute;
    expectedShipmentVersion: number;
    facts?: Readonly<{ storageHandlingUsed?: boolean }>;
  }): Promise<Checklist>;
  getChecklist(shipmentId: string): Promise<Checklist>;
  updateRouteItem(input: Command | Record<string, unknown>): Promise<{ value: Checklist; replayed: boolean }>;
  getClosureBlockers(shipmentId: string): Promise<readonly Readonly<{ code: string; subjectId: string; itemCode: string }>[]>;
}
interface RouteModule {
  FIXED_ROUTE_TEMPLATES: Readonly<Record<TradeRoute, Readonly<{ route: TradeRoute; version: number; items: readonly Readonly<{ code: string; label: string; kind: string; required: boolean; applicabilityRule: string | null }>[] }>>>;
  createInMemoryRouteService(options: { evidenceIds: readonly string[]; now: () => string }): RouteService;
}

async function loadRoutes(): Promise<RouteModule> {
  return import("../../../src/modules/routes/route-service.ts") as Promise<RouteModule>;
}
function isProblem(code: string) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code;
}
function command(checklist: Checklist, item: RouteItem, key: string, fields: Partial<Command> = {}): Command {
  return {
    shipmentId: checklist.shipmentId,
    itemId: item.id,
    expectedVersion: checklist.version,
    idempotencyKey: key,
    correlationId: key,
    principal: ACTOR,
    state: "SATISFIED",
    ...fields,
  };
}

const expectedItems: Readonly<Record<TradeRoute, readonly string[]>> = Object.freeze({
  FOREIGN_TO_FOREIGN: [
    "ORIGIN_AND_DESTINATION",
    "TRANSPORT_REFERENCE",
    "ORIGIN_EXPORT_EVIDENCE",
    "DEPARTURE",
    "ARRIVAL",
    "DELIVERY",
  ],
  UAE_FREE_ZONE_REEXPORT: [
    "FREE_ZONE_ENTRY",
    "STORAGE_HANDLING",
    "REEXPORT_CUSTOMS",
    "OUTBOUND_TRANSPORT",
    "DELIVERY",
  ],
  UAE_IMPORT: [
    "UAE_IMPORT_DECLARATION",
    "CUSTOMS_CLEARANCE_AND_CHARGES",
    "INBOUND_TRANSPORT",
    "RELEASE",
    "DELIVERY",
  ],
});

test("the three code-defined templates have immutable versioned required-item snapshots", async () => {
  const { FIXED_ROUTE_TEMPLATES } = await loadRoutes();
  assert.deepEqual(Object.keys(FIXED_ROUTE_TEMPLATES), Object.keys(expectedItems));
  for (const route of Object.keys(expectedItems) as TradeRoute[]) {
    const template = FIXED_ROUTE_TEMPLATES[route];
    assert.equal(template.route, route);
    assert.equal(template.version, 1);
    assert.deepEqual(template.items.map((item) => item.code), expectedItems[route]);
    assert.ok(template.items.every((item) => item.required));
    assert.ok(template.items.every((item) => item.label.length > 0));
    assert.ok(Object.isFrozen(template));
    assert.ok(Object.isFrozen(template.items));
    assert.ok(template.items.every(Object.isFrozen));
  }
});

test("each shipment snapshots one template version and storage handling is N/A only by the fixed rule", async () => {
  const { createInMemoryRouteService } = await loadRoutes();
  for (const route of Object.keys(expectedItems) as TradeRoute[]) {
    const service = createInMemoryRouteService({ evidenceIds: [EVIDENCE_ID], now: () => "2026-11-07T08:00:00.000Z" });
    const checklist = await service.snapshotChecklist({
      shipmentId: SHIPMENT_ID,
      route,
      expectedShipmentVersion: 1,
      facts: { storageHandlingUsed: false },
    });
    assert.equal(checklist.route, route);
    assert.equal(checklist.templateVersion, 1);
    assert.equal(checklist.version, 1);
    assert.deepEqual(checklist.items.map((item) => item.code), expectedItems[route]);
    assert.ok(checklist.items.every((item) => item.state === "NOT_STARTED" || item.code === "STORAGE_HANDLING"));
    const storage = checklist.items.find((item) => item.code === "STORAGE_HANDLING");
    if (route === "UAE_FREE_ZONE_REEXPORT") {
      assert.equal(storage?.applicabilityRule, "STORAGE_HANDLING_USED");
      assert.equal(storage?.state, "NOT_APPLICABLE_BY_RULE");
    } else {
      assert.equal(storage, undefined);
    }
  }
});

test("clients cannot select N/A, mutate a snapshot, or create a configurable route", async () => {
  const { createInMemoryRouteService } = await loadRoutes();
  const service = createInMemoryRouteService({ evidenceIds: [EVIDENCE_ID], now: () => "2026-11-07T08:00:00.000Z" });
  const checklist = await service.snapshotChecklist({ shipmentId: SHIPMENT_ID, route: "UAE_IMPORT", expectedShipmentVersion: 1 });
  const item = checklist.items[0]!;
  await assert.rejects(
    () => service.updateRouteItem({ ...command(checklist, item, "route-na-client"), state: "NOT_APPLICABLE_BY_RULE" }),
    isProblem("VALIDATION_FAILED"),
  );
  await assert.rejects(
    () => service.updateRouteItem({ ...command(checklist, item, "route-template-mutation"), templateVersion: 99, label: "Injected" }),
    isProblem("VALIDATION_FAILED"),
  );
  await assert.rejects(
    () => service.snapshotChecklist({ shipmentId: `${SHIPMENT_ID}-dynamic`, route: "CUSTOM_ROUTE" as TradeRoute, expectedShipmentVersion: 1 }),
    isProblem("VALIDATION_FAILED"),
  );
});

test("evidence and milestone items require their exact completion proof", async () => {
  const { createInMemoryRouteService } = await loadRoutes();
  const service = createInMemoryRouteService({ evidenceIds: [EVIDENCE_ID], now: () => "2026-11-07T08:00:00.000Z" });
  let checklist = await service.snapshotChecklist({ shipmentId: SHIPMENT_ID, route: "FOREIGN_TO_FOREIGN", expectedShipmentVersion: 1 });
  const evidence = checklist.items.find((item) => item.code === "ORIGIN_EXPORT_EVIDENCE")!;
  await assert.rejects(() => service.updateRouteItem(command(checklist, evidence, "route-evidence-missing")), isProblem("ROUTE_ITEM_PROOF_REQUIRED"));
  checklist = (await service.updateRouteItem(command(checklist, evidence, "route-evidence-valid", { evidenceId: EVIDENCE_ID }))).value;
  assert.equal(checklist.items.find((item) => item.id === evidence.id)?.evidenceId, EVIDENCE_ID);

  const departure = checklist.items.find((item) => item.code === "DEPARTURE")!;
  await assert.rejects(() => service.updateRouteItem(command(checklist, departure, "route-milestone-missing")), isProblem("ROUTE_ITEM_PROOF_REQUIRED"));
  checklist = (await service.updateRouteItem(command(checklist, departure, "route-milestone-valid", { milestoneAt: "2026-11-07T07:30:00.000Z" }))).value;
  assert.equal(checklist.items.find((item) => item.id === departure.id)?.milestoneAt, "2026-11-07T07:30:00.000Z");
});

test("updates enforce version concurrency and idempotent replay without mutating stale work", async () => {
  const { createInMemoryRouteService } = await loadRoutes();
  const service = createInMemoryRouteService({ evidenceIds: [EVIDENCE_ID], now: () => "2026-11-07T08:00:00.000Z" });
  const initial = await service.snapshotChecklist({ shipmentId: SHIPMENT_ID, route: "UAE_IMPORT", expectedShipmentVersion: 1 });
  const item = initial.items.find((candidate) => candidate.code === "UAE_IMPORT_DECLARATION")!;
  const request = command(initial, item, "route-version-replay", { evidenceId: EVIDENCE_ID });
  const first = await service.updateRouteItem(request);
  const replay = await service.updateRouteItem(request);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  await assert.rejects(
    () => service.updateRouteItem(command(initial, initial.items[1]!, "route-stale-version", { evidenceId: EVIDENCE_ID })),
    isProblem("STALE_VERSION"),
  );
  assert.deepEqual(await service.getChecklist(SHIPMENT_ID), first.value);
});

test("every incomplete required route item is a bidirectional closure blocker until satisfied", async () => {
  const { createInMemoryRouteService } = await loadRoutes();
  const service = createInMemoryRouteService({ evidenceIds: [EVIDENCE_ID], now: () => "2026-11-07T08:00:00.000Z" });
  let checklist = await service.snapshotChecklist({ shipmentId: SHIPMENT_ID, route: "UAE_IMPORT", expectedShipmentVersion: 1 });
  let blockers = await service.getClosureBlockers(SHIPMENT_ID);
  assert.deepEqual(blockers.map((blocker) => blocker.itemCode), expectedItems.UAE_IMPORT);
  assert.ok(blockers.every((blocker) => blocker.code === "ROUTE_ITEM_INCOMPLETE" && blocker.subjectId === SHIPMENT_ID));

  for (const item of checklist.items) {
    const current = checklist.items.find((candidate) => candidate.id === item.id)!;
    const proof = current.kind === "MILESTONE"
      ? { milestoneAt: "2026-11-07T07:30:00.000Z" }
      : current.kind === "EVIDENCE"
        ? { evidenceId: EVIDENCE_ID }
        : {};
    checklist = (await service.updateRouteItem(command(checklist, current, `route-close-${current.code.toLowerCase()}`, proof))).value;
  }
  blockers = await service.getClosureBlockers(SHIPMENT_ID);
  assert.deepEqual(blockers, []);
  assert.equal(checklist.closureComplete, true);
});
