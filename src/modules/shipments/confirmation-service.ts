import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { calculateQuantitySummary, type ShipmentExecutionState } from "./shipment-query.ts";

type Principal = Readonly<{ userId: string; displayName?: string; roles: readonly string[] }>;
type Kind = "SUPPLIER" | "SALES";
interface Dataset { readonly datasetId: string; readonly revisionNo: number; readonly datasetHash: string; readonly quantity: string }
interface Shipment { readonly id: string; readonly kind: Kind; readonly projectId: string; readonly version: number; readonly executionState: ShipmentExecutionState; readonly activeDataset: Dataset; readonly contractedQuantity: string; readonly primarySupplierShipmentId?: string | null }
interface Source { readonly id: string; readonly projectId: string; readonly executionState: ShipmentExecutionState; readonly coffeeSpecificationId: string }
interface Approval { readonly id: string; readonly actionCode: "SUPPLIER_SHIPMENT_CONFIRMATION" | "SALES_SHIPMENT_CONFIRMATION"; readonly subjectId: string; readonly subjectVersion: number; readonly subjectHash: string; readonly boundSourceId: string | null; readonly requester: Principal; readonly requestedAt: string; readonly decision: "PENDING" | "APPROVED" | "REJECTED"; readonly version: number; readonly approverId?: string; readonly decidedAt?: string; readonly comment?: string }
interface State { approvals: Map<string, Approval>; shipments: Map<string, Shipment>; supplierSources: Map<string, Source>; replays: Map<string, { hash: string; value: unknown }>; audit: Readonly<Record<string, unknown>>[] }
export interface ShipmentConfirmationService {
  submitSupplierConfirmation(input: Record<string, unknown>): Promise<{ value: Approval; replayed: boolean }>;
  submitSalesConfirmation(input: Record<string, unknown>): Promise<{ value: Approval; replayed: boolean }>;
  applyDecision(input: Record<string, unknown>): Promise<Approval>;
  confirmSupplier(input: Record<string, unknown>): Promise<{ value: unknown; replayed: boolean }>;
  confirmSales(input: Record<string, unknown>): Promise<{ value: unknown; replayed: boolean }>;
  getWorkspace(kind: Kind, id: string): Promise<unknown>;
}
const internals = new WeakMap<ShipmentConfirmationService, State>();
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function principal(input: Record<string, unknown>): Principal { const value = input.principal as Principal; if (!value?.userId || !Array.isArray(value.roles) || !value.roles.some((role) => ["OWNER_ADMIN", "OPERATIONS"].includes(role))) fail("PERMISSION_DENIED", 403, String(input.correlationId ?? randomUUID())); return value; }
function expected(shipment: Shipment, value: unknown, correlationId: string): void { if (!Number.isSafeInteger(value) || value !== shipment.version) fail("STALE_VERSION", 412, correlationId); }

export function createInMemoryShipmentConfirmationService(options: { now: () => string; shipments: readonly Shipment[]; supplierSources?: readonly Source[] }): ShipmentConfirmationService {
  const state: State = { approvals: new Map(), shipments: new Map(options.shipments.map((row) => [row.id, Object.freeze(clone(row))])), supplierSources: new Map((options.supplierSources ?? []).map((row) => [row.id, Object.freeze(clone(row))])), replays: new Map(), audit: [] };
  async function once<T>(operation: string, input: Record<string, unknown>, work: () => T): Promise<{ value: T; replayed: boolean }> {
    const actor = principal(input), correlationId = String(input.correlationId ?? randomUUID()), key = input.idempotencyKey;
    if (typeof key !== "string" || key.length < 8) fail("VALIDATION_FAILED", 400, correlationId);
    const request = Object.fromEntries(Object.entries(input).filter(([name]) => !["principal", "correlationId", "idempotencyKey"].includes(name))), scope = `${actor.userId}:${operation}:${key}`, hash = digest(request), prior = state.replays.get(scope);
    if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, correlationId); return { value: clone(prior.value) as T, replayed: true }; }
    const value = work(); state.replays.set(scope, { hash, value: clone(value) }); return { value, replayed: false };
  }
  const shipmentOf = (id: unknown, kind: Kind, correlationId: string): Shipment => { const row = state.shipments.get(String(id)); if (!row || row.kind !== kind) fail("RESOURCE_NOT_FOUND", 404, correlationId); return row; };
  const binding = (shipment: Shipment): { hash: string; sourceId: string | null } => {
    const sourceId = shipment.kind === "SALES" ? shipment.primarySupplierShipmentId ?? null : null;
    return { sourceId, hash: shipment.kind === "SALES" ? digest({ datasetHash: shipment.activeDataset.datasetHash, sourceId }) : shipment.activeDataset.datasetHash };
  };
  const workspace = (shipment: Shipment) => Object.freeze({ ...clone(shipment), quantities: calculateQuantitySummary({ contracted: shipment.contractedQuantity, kind: shipment.kind, shipments: [...state.shipments.values()].filter((row) => row.kind === shipment.kind && row.projectId === shipment.projectId).map((row) => ({ quantity: row.activeDataset.quantity, executionState: row.executionState })) }), confirmationApprovalId: [...state.approvals.values()].find((row) => row.subjectId === shipment.activeDataset.datasetId)?.id ?? null });
  function submit(kind: Kind, input: Record<string, unknown>): Promise<{ value: Approval; replayed: boolean }> {
    const correlationId = String(input.correlationId ?? randomUUID());
    return once(kind === "SUPPLIER" ? "submitSupplierShipmentConfirmation" : "submitSalesShipmentConfirmation", input, () => {
      const actor = principal(input), shipment = shipmentOf(input.shipmentId, kind, correlationId); expected(shipment, input.expectedVersion, correlationId);
      if (shipment.executionState !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, correlationId);
      const current = binding(shipment);
      if (kind === "SALES") { if (!current.sourceId) fail("PRIMARY_SOURCE_REQUIRED", 409, correlationId); const source = state.supplierSources.get(current.sourceId); if (!source || source.executionState !== "CONFIRMED" || source.projectId !== shipment.projectId) fail("PRIMARY_SOURCE_INVALID", 409, correlationId); }
      const approval: Approval = Object.freeze({ id: randomUUID(), actionCode: kind === "SUPPLIER" ? "SUPPLIER_SHIPMENT_CONFIRMATION" : "SALES_SHIPMENT_CONFIRMATION", subjectId: shipment.activeDataset.datasetId, subjectVersion: shipment.activeDataset.revisionNo, subjectHash: current.hash, boundSourceId: current.sourceId, requester: Object.freeze(clone(actor)), requestedAt: options.now(), decision: "PENDING", version: 1 });
      state.approvals.set(approval.id, approval); state.audit.push(Object.freeze({ action: `${kind}_SHIPMENT_SUBMITTED`, aggregateId: shipment.id, actorId: actor.userId, occurredAt: options.now(), correlationId })); return approval;
    });
  }
  function confirm(kind: Kind, input: Record<string, unknown>): Promise<{ value: unknown; replayed: boolean }> {
    const correlationId = String(input.correlationId ?? randomUUID());
    return once(kind === "SUPPLIER" ? "confirmSupplierShipment" : "confirmSalesShipment", input, () => {
      const actor = principal(input), shipment = shipmentOf(input.shipmentId, kind, correlationId); expected(shipment, input.expectedVersion, correlationId);
      const current = binding(shipment);
      if (kind === "SALES" && (input.primarySupplierShipmentId === null || !current.sourceId)) fail("PRIMARY_SOURCE_REQUIRED", 409, correlationId);
      const approval = state.approvals.get(String(input.approvalId));
      if (!approval || approval.actionCode !== (kind === "SUPPLIER" ? "SUPPLIER_SHIPMENT_CONFIRMATION" : "SALES_SHIPMENT_CONFIRMATION")) fail("APPROVAL_VERSION_MISMATCH", 409, correlationId);
      if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", 409, correlationId);
      if (approval.subjectId !== shipment.activeDataset.datasetId || approval.subjectVersion !== shipment.activeDataset.revisionNo || approval.subjectHash !== current.hash || approval.boundSourceId !== current.sourceId) fail("APPROVAL_VERSION_MISMATCH", 409, correlationId);
      const next = Object.freeze({ ...shipment, executionState: "CONFIRMED" as const, version: shipment.version + 1 }); state.shipments.set(next.id, next); state.audit.push(Object.freeze({ action: `${kind}_SHIPMENT_CONFIRMED`, aggregateId: next.id, aggregateVersion: next.version, actorId: actor.userId, occurredAt: options.now(), correlationId })); return workspace(next);
    });
  }
  const service: ShipmentConfirmationService = {
    submitSupplierConfirmation: (input) => submit("SUPPLIER", input), submitSalesConfirmation: (input) => submit("SALES", input),
    async applyDecision(input) { const approval = state.approvals.get(String(input.approvalId)), approver = input.approver as Principal; if (!approval) fail("RESOURCE_NOT_FOUND", 404); if (approver?.userId === approval.requester.userId) fail("SELF_APPROVAL_FORBIDDEN", 409); if (!approver?.roles?.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403); if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409); const shipment = [...state.shipments.values()].find((row) => row.activeDataset.datasetId === approval.subjectId), current = shipment && binding(shipment); if (!shipment || shipment.activeDataset.revisionNo !== approval.subjectVersion || current!.hash !== approval.subjectHash || current!.sourceId !== approval.boundSourceId) fail("APPROVAL_VERSION_MISMATCH", 409); if (input.decision !== "APPROVED" && input.decision !== "REJECTED") fail("VALIDATION_FAILED", 400); const next = Object.freeze({ ...approval, decision: input.decision, version: approval.version + 1, approverId: approver.userId, decidedAt: options.now(), comment: String(input.comment ?? "") }) as Approval; state.approvals.set(next.id, next); return clone(next); },
    confirmSupplier: (input) => confirm("SUPPLIER", input), confirmSales: (input) => confirm("SALES", input),
    async getWorkspace(kind, id) { return workspace(shipmentOf(id, kind, `get-${kind.toLowerCase()}-workspace`)); },
  };
  internals.set(service, state); return service;
}
export function readShipmentConfirmationState(service: ShipmentConfirmationService) { const state = internals.get(service); return Object.freeze({ approvals: Object.freeze([...(state?.approvals.values() ?? [])].map(clone)), shipments: Object.freeze([...(state?.shipments.values() ?? [])].map(clone)), audit: Object.freeze((state?.audit ?? []).map(clone)) }); }
