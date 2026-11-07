import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { projectSupplierInvoiceProjection, supplierShipmentInvoiceProjection } from "./supplier-invoice-query.ts";

type Principal = Readonly<{ userId: string; displayName?: string; roles: readonly string[] }>;
type InvoiceState = "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "REJECTED" | "CANCELLED";
interface Shipment { readonly id: string; readonly projectId: string; readonly supplierId: string; readonly executionState: string; readonly version: number }
interface Evidence { readonly id: string; readonly projectId: string; readonly state: string; readonly sha256: string }
export interface SupplierInvoice {
  readonly id: string; readonly projectId: string; readonly supplierShipmentId: string; readonly supplierId: string;
  readonly reference: string; readonly invoiceDate: string; readonly amount: string; readonly outstandingAmount: string;
  readonly allocatedAmount: string; readonly currency: string; readonly evidenceId: string; readonly state: InvoiceState;
  readonly approvalId: string | null; readonly cancellationReason: string | null; readonly version: number;
}
interface StoredInvoice {
  id: string; projectId: string; supplierShipmentId: string; supplierId: string; reference: string; invoiceDate: string;
  amount: string; outstandingAmount: string; allocatedAmount: string; currency: string; evidenceId: string; state: InvoiceState;
  approvalId: string | null; cancellationReason: string | null; version: number;
}
interface Approval {
  readonly id: string; readonly actionCode: "SUPPLIER_INVOICE_CONFIRMATION"; readonly subjectType: "SUPPLIER_INVOICE";
  readonly subjectId: string; readonly subjectVersion: number; readonly subjectHash: string; readonly requesterId: string;
  readonly requestedAt: string; readonly evidenceId: string; readonly decision: "PENDING" | "APPROVED" | "REJECTED";
  readonly version: number; readonly approverId?: string; readonly decidedAt?: string;
}
interface State {
  shipments: Map<string, Shipment>; evidence: Map<string, Evidence>; invoices: Map<string, StoredInvoice>;
  approvals: Map<string, Approval>; replays: Map<string, { hash: string; value: unknown }>; audit: Readonly<Record<string, unknown>>[];
}
export interface SupplierInvoiceService {
  create(input: Record<string, unknown>): Promise<{ value: SupplierInvoice; replayed: boolean }>;
  submitForApproval(input: Record<string, unknown>): Promise<{ value: Approval; replayed: boolean }>;
  decideApproval(input: Record<string, unknown>): Promise<Approval>;
  confirm(input: Record<string, unknown>): Promise<{ value: SupplierInvoice; replayed: boolean }>;
  cancel(input: Record<string, unknown>): Promise<{ value: SupplierInvoice; replayed: boolean }>;
  get(invoiceId: string): Promise<SupplierInvoice>;
  supplierShipmentProjection(shipmentId: string): Promise<unknown>;
  projectProjection(projectId: string): Promise<unknown>;
  setAllocatedAmount(invoiceId: string, amount: string): Promise<void>;
}
const internals = new WeakMap<SupplierInvoiceService, State>();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function six(value: DecimalAmount): string { const [whole, fraction = ""] = value.toString().split("."); return `${whole}.${fraction.padEnd(6, "0")}`; }
function positiveAmount(value: unknown, correlationId: string): string { try { if (typeof value !== "string") throw new TypeError(); const amount = DecimalAmount.parse(value); if (amount.isNegative() || amount.isZero() || amount.scale > 6) throw new TypeError(); return six(amount); } catch { fail("VALIDATION_FAILED", 400, correlationId); } }
function actor(input: Record<string, unknown>, correlationId: string): Principal { const value = input.principal as Principal | undefined; if (!value?.userId || !Array.isArray(value.roles) || !value.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) fail("PERMISSION_DENIED", 403, correlationId); return value; }
function current(state: State, invoiceId: unknown, correlationId: string): StoredInvoice { const invoice = state.invoices.get(String(invoiceId)); if (!invoice) fail("RESOURCE_NOT_FOUND", 404, correlationId); return invoice; }
function expected(invoice: StoredInvoice, value: unknown, correlationId: string): void { if (!Number.isSafeInteger(value) || value !== invoice.version) fail("STALE_VERSION", 412, correlationId); }
function publicInvoice(invoice: StoredInvoice): SupplierInvoice { return clone(invoice); }
function subjectHash(invoice: StoredInvoice): string { return digest({ id: invoice.id, projectId: invoice.projectId, supplierShipmentId: invoice.supplierShipmentId, supplierId: invoice.supplierId, reference: invoice.reference, invoiceDate: invoice.invoiceDate, amount: invoice.amount, currency: invoice.currency, evidenceId: invoice.evidenceId }); }

export function createInMemorySupplierInvoiceService(options: { now: () => string; shipments: readonly Shipment[]; evidence: readonly Evidence[] }): SupplierInvoiceService {
  const state: State = { shipments: new Map(options.shipments.map((row) => [row.id, clone(row)])), evidence: new Map(options.evidence.map((row) => [row.id, clone(row)])), invoices: new Map(), approvals: new Map(), replays: new Map(), audit: [] };
  async function once<T>(operation: string, input: Record<string, unknown>, work: (principal: Principal, correlationId: string) => T): Promise<{ value: T; replayed: boolean }> {
    const correlationId = typeof input.correlationId === "string" && input.correlationId ? input.correlationId : randomUUID();
    const principal = actor(input, correlationId), key = input.idempotencyKey;
    if (typeof key !== "string" || key.length < 8) fail("VALIDATION_FAILED", 400, correlationId);
    const request = Object.fromEntries(Object.entries(input).filter(([name]) => !["principal", "correlationId", "idempotencyKey"].includes(name)));
    const scope = `${principal.userId}:${operation}:${key}`, hash = digest(request), prior = state.replays.get(scope);
    if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, correlationId); return { value: clone(prior.value) as T, replayed: true }; }
    const value = work(principal, correlationId); state.replays.set(scope, { hash, value: clone(value) }); return { value: clone(value), replayed: false };
  }
  function audit(action: string, principal: Principal, invoice: StoredInvoice, correlationId: string, reason?: string) { state.audit.push(Object.freeze({ action, projectId: invoice.projectId, aggregateType: "SUPPLIER_INVOICE", aggregateId: invoice.id, aggregateVersion: invoice.version, actorId: principal.userId, occurredAt: options.now(), correlationId, reason: reason ?? null })); }
  const service: SupplierInvoiceService = {
    async create(input) {
      return once("createSupplierInvoice", input, (principal, correlationId) => {
        const reference = typeof input.reference === "string" ? input.reference.trim() : "";
        const duplicate = [...state.invoices.values()].find((row) => row.supplierId === input.supplierId && row.reference === reference && row.state !== "CANCELLED");
        if (duplicate) fail("DUPLICATE_REFERENCE", 409, correlationId);
        const shipment = state.shipments.get(String(input.shipmentId));
        if (!shipment) fail("RESOURCE_NOT_FOUND", 404, correlationId);
        if (input.expectedVersion !== shipment.version) fail("STALE_VERSION", 412, correlationId);
        const evidence = state.evidence.get(String(input.evidenceId));
        if (shipment.executionState !== "RECEIVED" || input.supplierId !== shipment.supplierId || !evidence || evidence.projectId !== shipment.projectId || evidence.state !== "AVAILABLE") fail("VALIDATION_FAILED", 400, correlationId);
        if (!reference || !DATE.test(String(input.invoiceDate)) || !CURRENCY.test(String(input.currency))) fail("VALIDATION_FAILED", 400, correlationId);
        const amount = positiveAmount(input.amount, correlationId);
        const invoice: StoredInvoice = { id: randomUUID(), projectId: shipment.projectId, supplierShipmentId: shipment.id, supplierId: shipment.supplierId, reference, invoiceDate: String(input.invoiceDate), amount, outstandingAmount: amount, allocatedAmount: "0.000000", currency: String(input.currency), evidenceId: evidence.id, state: "DRAFT", approvalId: null, cancellationReason: null, version: 1 };
        state.invoices.set(invoice.id, invoice); audit("SUPPLIER_INVOICE_CREATED", principal, invoice, correlationId); return publicInvoice(invoice);
      });
    },
    async submitForApproval(input) {
      return once("submitSupplierInvoice", input, (principal, correlationId) => {
        const invoice = current(state, input.invoiceId, correlationId); expected(invoice, input.expectedVersion, correlationId);
        if (invoice.state !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, correlationId);
        const approval: Approval = Object.freeze({ id: randomUUID(), actionCode: "SUPPLIER_INVOICE_CONFIRMATION", subjectType: "SUPPLIER_INVOICE", subjectId: invoice.id, subjectVersion: invoice.version, subjectHash: subjectHash(invoice), requesterId: principal.userId, requestedAt: options.now(), evidenceId: invoice.evidenceId, decision: "PENDING", version: 1 });
        invoice.state = "PENDING_APPROVAL"; invoice.approvalId = approval.id; invoice.version += 1; state.approvals.set(approval.id, approval); audit("SUPPLIER_INVOICE_SUBMITTED", principal, invoice, correlationId); return clone(approval);
      });
    },
    async decideApproval(input) {
      const correlationId = typeof input.correlationId === "string" ? input.correlationId : randomUUID(), approval = state.approvals.get(String(input.approvalId)), approver = input.approver as Principal | undefined;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404, correlationId);
      if (!approver?.userId || !Array.isArray(approver.roles)) fail("PERMISSION_DENIED", 403, correlationId);
      if (approver.userId === approval.requesterId) fail("SELF_APPROVAL_FORBIDDEN", 409, correlationId);
      if (!approver.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, correlationId);
      if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409, correlationId);
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED") fail("VALIDATION_FAILED", 400, correlationId);
      const invoice = current(state, approval.subjectId, correlationId);
      if (invoice.approvalId !== approval.id || invoice.version !== approval.subjectVersion + 1 || subjectHash(invoice) !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409, correlationId);
      const next = Object.freeze({ ...approval, decision: input.decision, version: approval.version + 1, approverId: approver.userId, decidedAt: options.now() }) as Approval;
      state.approvals.set(next.id, next);
      if (input.decision === "REJECTED") { invoice.state = "REJECTED"; invoice.version += 1; audit("SUPPLIER_INVOICE_REJECTED", approver, invoice, correlationId); }
      return clone(next);
    },
    async confirm(input) {
      return once("confirmSupplierInvoice", input, (principal, correlationId) => {
        const invoice = current(state, input.invoiceId, correlationId); expected(invoice, input.expectedVersion, correlationId);
        const approval = state.approvals.get(String(input.approvalId));
        if (!approval || approval.actionCode !== "SUPPLIER_INVOICE_CONFIRMATION" || approval.subjectId !== invoice.id || approval.subjectVersion + 1 !== invoice.version || approval.subjectHash !== subjectHash(invoice)) fail("APPROVAL_VERSION_MISMATCH", 409, correlationId);
        if (approval.decision !== "APPROVED") fail("APPROVAL_REQUIRED", 409, correlationId);
        if (invoice.state !== "PENDING_APPROVAL") fail("INVALID_STATE_TRANSITION", 409, correlationId);
        invoice.state = "CONFIRMED"; invoice.version += 1; audit("SUPPLIER_INVOICE_CONFIRMED", principal, invoice, correlationId); return publicInvoice(invoice);
      });
    },
    async cancel(input) {
      return once("cancelUnallocatedSupplierInvoice", input, (principal, correlationId) => {
        if (!principal.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, correlationId);
        const invoice = current(state, input.invoiceId, correlationId); expected(invoice, input.expectedVersion, correlationId);
        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        if (reason.length < 3) fail("VALIDATION_FAILED", 400, correlationId);
        if (invoice.state !== "CONFIRMED" || invoice.allocatedAmount !== "0.000000" || invoice.outstandingAmount !== invoice.amount) fail("INVALID_STATE_TRANSITION", 409, correlationId);
        invoice.state = "CANCELLED"; invoice.outstandingAmount = "0.000000"; invoice.cancellationReason = reason; invoice.version += 1; audit("SUPPLIER_INVOICE_CANCELLED", principal, invoice, correlationId, reason); return publicInvoice(invoice);
      });
    },
    async get(invoiceId) { return publicInvoice(current(state, invoiceId, `get-${invoiceId}`)); },
    async supplierShipmentProjection(shipmentId) { return supplierShipmentInvoiceProjection([...state.invoices.values()], shipmentId); },
    async projectProjection(projectId) { return projectSupplierInvoiceProjection([...state.invoices.values()], projectId); },
    async setAllocatedAmount(invoiceId, amount) {
      const invoice = current(state, invoiceId, `allocate-${invoiceId}`); if (invoice.state !== "CONFIRMED") fail("INVALID_STATE_TRANSITION", 409);
      const allocated = positiveAmount(amount, `allocate-${invoiceId}`), value = DecimalAmount.parse(allocated);
      if (value.compare(DecimalAmount.parse(invoice.amount)) > 0) fail("VALIDATION_FAILED", 400);
      invoice.allocatedAmount = allocated; invoice.outstandingAmount = six(DecimalAmount.parse(invoice.amount).subtract(value));
    },
  };
  internals.set(service, state); return service;
}

export function readSupplierInvoiceState(service: SupplierInvoiceService) {
  const state = internals.get(service);
  return Object.freeze({ invoices: Object.freeze([...(state?.invoices.values() ?? [])].map(publicInvoice)), approvals: Object.freeze([...(state?.approvals.values() ?? [])].map(clone)), audit: Object.freeze((state?.audit ?? []).map(clone)) });
}
