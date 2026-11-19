// @ts-expect-error Native Node TypeScript tests require source extensions.
import { KINDS, REASON_REQUIRED, TRANSITIONS, type ExecutionState, type ShipmentKind } from "./shipment-kinds.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentStoreError, type ApprovalInboxItem, type DatasetChanges, type PrismaShipmentExecutionStore, type ShipmentDetail } from "./shipment-execution-store.ts";

export type ShipmentExecutionStore = Pick<PrismaShipmentExecutionStore, keyof PrismaShipmentExecutionStore>;

export interface ShipmentActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

export class ShipmentProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export type ShipmentAction =
  | "REVISE" | "SET_SOURCE" | "SUBMIT_CONFIRMATION" | "APPROVE_CONFIRMATION" | "REJECT_CONFIRMATION"
  | "START_TRANSIT" | "MARK_ARRIVED" | "CANCEL" | "REJECT";

export interface ShipmentView extends ShipmentDetail {
  readonly availableActions: readonly ShipmentAction[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
const ISO = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const READ = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"], WRITE = ["OWNER_ADMIN", "OPERATIONS"];

const invalid = (detail: string) => new ShipmentProblem(422, "VALIDATION_FAILED", detail);

function requireRole(actor: ShipmentActor, roles: readonly string[]) {
  if (!actor.roles.some((role) => roles.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot do this.");
}
function id(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid(`${field} is not a valid id.`);
  return value.toLowerCase();
}
function version(value: unknown): number {
  const number = typeof value === "string" ? Number(value.replaceAll('"', "")) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) throw new ShipmentProblem(428, "PRECONDITION_REQUIRED", "expectedVersion is required.");
  return number;
}
function text(value: unknown, field: string, max: number, min = 1): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw invalid(`${field} must be ${min}-${max} characters.`);
  return value.trim().replace(/\s+/g, " ");
}
function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return text(value, field, max);
}
function decimal(value: unknown, field: string): string {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !DECIMAL.test(raw.trim()) || Number(raw) <= 0) throw invalid(`${field} must be a positive number with up to 6 decimals.`);
  const [whole, fraction = ""] = raw.trim().split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}
function date(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !ISO.test(value) || Number.isNaN(Date.parse(value))) throw invalid(`${field} must be a date.`);
  return new Date(value).toISOString();
}
function list(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 200) throw invalid(`${field} must be a list of up to 200 values.`);
  const items = value.map((item) => text(item, field, 100).toUpperCase());
  if (new Set(items).size !== items.length) throw invalid(`${field} has duplicates.`);
  return items;
}

const EDITABLE = new Set(["quantity", "bagCount", "bagWeight", "netWeight", "grossWeight", "lotOrOrderReference", "containerNumbers", "sealNumbers", "transportCarrier", "transportReference", "vesselOrVehicle", "voyageOrTrip", "estimatedDeparture", "estimatedArrival", "plannedShipmentAt", "notes"]);

export function parseDatasetChanges(body: Record<string, unknown>): DatasetChanges {
  const raw = body.changes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("changes must be an object.");
  const input = raw as Record<string, unknown>;
  const unknown = Object.keys(input).filter((key) => !EDITABLE.has(key));
  if (unknown.length) throw invalid(`These fields cannot be edited here: ${unknown.join(", ")}.`);
  const changes: Record<string, unknown> = {
    quantity: input.quantity === undefined ? undefined : decimal(input.quantity, "Quantity"),
    bagCount: input.bagCount === undefined ? undefined : (() => { const n = Number(input.bagCount); if (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000) throw invalid("Bag count must be a whole number of at least 1."); return n; })(),
    bagWeight: input.bagWeight === undefined ? undefined : decimal(input.bagWeight, "Bag weight"),
    netWeight: input.netWeight === undefined ? undefined : decimal(input.netWeight, "Net weight"),
    grossWeight: input.grossWeight === undefined ? undefined : decimal(input.grossWeight, "Gross weight"),
    lotOrOrderReference: optionalText(input.lotOrOrderReference, "Reference", 100),
    containerNumbers: list(input.containerNumbers, "Container numbers"),
    sealNumbers: list(input.sealNumbers, "Seal numbers"),
    transportCarrier: input.transportCarrier === undefined ? undefined : text(input.transportCarrier, "Carrier", 200),
    transportReference: input.transportReference === undefined ? undefined : text(input.transportReference, "Transport reference", 100),
    vesselOrVehicle: optionalText(input.vesselOrVehicle, "Vessel or vehicle", 200),
    voyageOrTrip: optionalText(input.voyageOrTrip, "Voyage or trip", 100),
    estimatedDeparture: date(input.estimatedDeparture, "Estimated departure"),
    estimatedArrival: date(input.estimatedArrival, "Estimated arrival"),
    plannedShipmentAt: date(input.plannedShipmentAt, "Planned shipment date"),
    notes: optionalText(input.notes, "Notes", 2000),
  };
  const result = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as DatasetChanges;
  if (Object.keys(result).length === 0) throw invalid("Nothing to change.");
  if (result.netWeight && result.grossWeight && Number(result.grossWeight) < Number(result.netWeight)) throw invalid("Gross weight cannot be less than net weight.");
  if (result.estimatedDeparture && result.estimatedArrival && result.estimatedArrival < result.estimatedDeparture) throw invalid("Arrival cannot be before departure.");
  return result;
}

function translate(error: unknown): never {
  if (error instanceof ShipmentStoreError) {
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    if (error.code === "STALE_VERSION") throw new ShipmentProblem(412, "STALE_VERSION", error.message);
    if (error.code === "INVALID") throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
    throw new ShipmentProblem(409, "STATE_CONFLICT", error.message);
  }
  if ((error as { code?: string })?.code === "23505") throw new ShipmentProblem(409, "IDEMPOTENCY_CONFLICT", "This request was already applied.");
  throw error;
}

/** What this actor may do next with this shipment. The server enforces the same rules on every command. */
export function availableActions(detail: ShipmentDetail, actor: ShipmentActor): ShipmentAction[] {
  const write = actor.roles.some((role) => WRITE.includes(role));
  const owner = actor.roles.includes("OWNER_ADMIN");
  const state = detail.executionState, pending = detail.pendingApproval;
  const actions: ShipmentAction[] = [];
  const allowed = (to: string) => TRANSITIONS[detail.kind].has(`${state}->${to}`);
  if (write && state === "DRAFT" && !pending) {
    actions.push("REVISE");
    if (detail.kind === "SALES") actions.push("SET_SOURCE");
    if (detail.kind === "SUPPLIER" || detail.primarySource) actions.push("SUBMIT_CONFIRMATION");
  }
  if (owner && pending && pending.requesterId !== actor.userId) actions.push("APPROVE_CONFIRMATION", "REJECT_CONFIRMATION");
  if (write) {
    if (allowed("IN_TRANSIT")) actions.push("START_TRANSIT");
    if (allowed(KINDS[detail.kind].arrivedState)) actions.push("MARK_ARRIVED");
    if (allowed("CANCELLED")) actions.push("CANCEL");
    if (allowed("REJECTED")) actions.push("REJECT");
  }
  return actions;
}

export function createShipmentExecutionService(store: ShipmentExecutionStore) {
  const view = (detail: ShipmentDetail, actor: ShipmentActor): ShipmentView => ({ ...detail, availableActions: availableActions(detail, actor) });

  return Object.freeze({
    async get(actor: ShipmentActor, kind: ShipmentKind, shipmentId: unknown): Promise<ShipmentView> {
      requireRole(actor, READ);
      try { return view(await store.detail(actor.tenantId, kind, id(shipmentId, "Shipment")), actor); } catch (error) { translate(error); }
    },

    async revise(actor: ShipmentActor, kind: ShipmentKind, shipmentId: unknown, body: Record<string, unknown>): Promise<ShipmentView> {
      requireRole(actor, WRITE);
      const input = { shipmentId: id(shipmentId, "Shipment"), expectedVersion: version(body.expectedVersion), reason: text(body.reason, "Reason for the change", 500, 3), changes: parseDatasetChanges(body) };
      try { return view(await store.revise({ tenantId: actor.tenantId, kind, actorId: actor.userId, ...input }), actor); } catch (error) { translate(error); }
    },

    async setPrimarySource(actor: ShipmentActor, shipmentId: unknown, body: Record<string, unknown>): Promise<ShipmentView> {
      requireRole(actor, WRITE);
      const input = { shipmentId: id(shipmentId, "Shipment"), supplierShipmentId: id(body.supplierShipmentId, "Supplier shipment"), expectedVersion: version(body.expectedVersion) };
      try { return view(await store.setPrimarySource({ tenantId: actor.tenantId, actorId: actor.userId, ...input }), actor); } catch (error) { translate(error); }
    },

    async submit(actor: ShipmentActor, kind: ShipmentKind, shipmentId: unknown, body: Record<string, unknown>): Promise<ShipmentView> {
      requireRole(actor, WRITE);
      const input = { shipmentId: id(shipmentId, "Shipment"), expectedVersion: version(body.expectedVersion) };
      try { return view(await store.submitForConfirmation({ tenantId: actor.tenantId, kind, actorId: actor.userId, ...input }), actor); } catch (error) { translate(error); }
    },

    async listApprovals(actor: ShipmentActor): Promise<{ items: ApprovalInboxItem[] }> {
      requireRole(actor, ["OWNER_ADMIN"]);
      return { items: await store.listPendingApprovals(actor.tenantId) };
    },

    async decide(actor: ShipmentActor, approvalId: unknown, body: Record<string, unknown>, idempotencyKey: string): Promise<ShipmentView> {
      requireRole(actor, ["OWNER_ADMIN"]);
      const decision = body.decision;
      if (decision !== "APPROVED" && decision !== "REJECTED") throw invalid("decision must be APPROVED or REJECTED.");
      const comment = decision === "REJECTED" ? text(body.comment, "Rejection reason", 500, 3) : (optionalText(body.comment, "Comment", 500) ?? null);
      try {
        return view(await store.decide({ tenantId: actor.tenantId, approvalId: id(approvalId, "Approval"), approverId: actor.userId, decision, comment, idempotencyKey }), actor);
      } catch (error) { translate(error); }
    },

    /** Confirmation happens when the owner approves. This endpoint reports the confirmed state for clients that call it afterwards. */
    async confirm(actor: ShipmentActor, kind: ShipmentKind, shipmentId: unknown): Promise<ShipmentView> {
      requireRole(actor, WRITE);
      const detail = await this.get(actor, kind, shipmentId);
      if (detail.executionState === "DRAFT") {
        throw new ShipmentProblem(409, "APPROVAL_REQUIRED", detail.pendingApproval ? "Waiting for the owner's approval." : "Submit the shipment for approval first.");
      }
      return detail;
    },

    async transition(actor: ShipmentActor, kind: ShipmentKind, shipmentId: unknown, body: Record<string, unknown>, idempotencyKey: string): Promise<ShipmentView> {
      requireRole(actor, WRITE);
      const toState = body.toState;
      const valid = ["IN_TRANSIT", "CANCELLED", "REJECTED", KINDS[kind].arrivedState];
      if (typeof toState !== "string" || !valid.includes(toState)) throw invalid(`toState must be one of ${valid.join(", ")}.`);
      const reason = REASON_REQUIRED.has(toState) ? text(body.reason, "Reason", 500, 3) : (optionalText(body.reason, "Note", 500) ?? null);
      const shipment = id(shipmentId, "Shipment");
      if (!/^[A-Za-z0-9-]{8,128}$/.test(idempotencyKey)) throw invalid("Idempotency-Key header is required.");
      if (await store.replayed(kind, shipment, idempotencyKey)) return this.get(actor, kind, shipment);
      try {
        return view(await store.transition({ tenantId: actor.tenantId, kind, shipmentId: shipment, expectedVersion: version(body.expectedVersion), actorId: actor.userId, toState: toState as ExecutionState, reason, idempotencyKey }), actor);
      } catch (error) {
        if ((error as { code?: string })?.code === "23505") return this.get(actor, kind, shipment);
        translate(error);
      }
    },
  });
}

export type ShipmentExecutionService = ReturnType<typeof createShipmentExecutionService>;
