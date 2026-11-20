// @ts-expect-error Native Node TypeScript tests require source extensions.
import { MOVEMENT_KINDS, MoneyStoreError, type MovementKind, type PrismaMoneyStore } from "./money-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DocumentStorageError, readDocument } from "../evidence/document-storage.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

type MoneyStore = Pick<PrismaMoneyStore, keyof PrismaMoneyStore>;

/**
 * Who does what (roles.ts):
 *  - receipts, payments, allocations, reversals: Owner administrator and Finance
 *  - expenses: anyone who works on the project records them (Operations included); Owner/Finance cancel
 *  - approvals: an owner other than the person who asked
 *  - reading the project's money: Owner and Finance; Operations sees expenses only
 */
const FINANCE = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const EXPENSE_WRITERS = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/;
const RATE = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,10})?$/;

const invalid = (detail: string) => new ShipmentProblem(422, "VALIDATION_FAILED", detail);

function requireRole(actor: ShipmentActor, roles: readonly string[]) {
  if (!actor.roles.some((role) => roles.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot do this.");
}
function id(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid(`${field} is not a valid id.`);
  return value.toLowerCase();
}
function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw invalid(`${field} must be ${min}-${max} characters.`);
  return value.trim().replace(/\s+/g, " ");
}
function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return null;
  return text(value, field, 1, max);
}
function amount(value: unknown, field = "Amount"): string {
  const raw = typeof value === "string" ? value.replaceAll(",", "").trim() : typeof value === "number" ? String(value) : "";
  if (!AMOUNT.test(raw) || Number(raw) <= 0) throw invalid(`${field} must be a positive amount with at most 2 decimals.`);
  return raw;
}
function currency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value.trim())) throw invalid("Currency must be a 3-letter code such as USD or AED.");
  return value.trim().toUpperCase();
}
/** Manual rate: AED for one unit of the currency, as applied by the bank. */
function fxRate(value: unknown, cur: string): string {
  const raw = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (cur === "AED") {
    if (raw && Number(raw) !== 1) throw invalid("For AED amounts the rate is 1.");
    return "1";
  }
  if (!RATE.test(raw) || Number(raw) <= 0) throw invalid(`Enter the AED rate used for ${cur} (for example 3.6725).`);
  return raw;
}
function date(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw invalid(`${field} must be a date (YYYY-MM-DD).`);
  const at = Date.parse(`${value}T00:00:00Z`);
  if (at > Date.now() + 86_400_000) throw invalid(`${field} cannot be in the future.`);
  if (at < Date.parse("2000-01-01T00:00:00Z")) throw invalid(`${field} is too old.`);
  return value;
}
function reason(body: unknown): string {
  return text((body as { reason?: unknown } | null)?.reason, "Reason", 3, 500);
}
const field = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? value : undefined; };

async function documentOf(form: FormData, label: string) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw invalid(`Attach the ${label} (PDF, JPG or PNG).`);
  return readDocument(file);
}

function translate(error: unknown): never {
  if (error instanceof MoneyStoreError) {
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    if (error.code === "INVALID") throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
    throw new ShipmentProblem(409, "STATE_CONFLICT", error.message);
  }
  if (error instanceof DocumentStorageError) {
    if (error.code === "STORAGE_UNAVAILABLE") throw new ShipmentProblem(503, "DEPENDENCY_UNAVAILABLE", error.message);
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
  }
  throw error;
}
const guarded = async <T>(work: () => Promise<T>): Promise<T> => { try { return await work(); } catch (error) { return translate(error); } };

export function createMoneyService(store: MoneyStore) {
  return Object.freeze({
    /** The project's money page. Operations get the expense part only (supplier costs stay with finance). */
    async projectMoney(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, EXPENSE_WRITERS);
      const money = await guarded(() => store.projectMoney(actor.tenantId, id(projectId, "Project")));
      if (actor.roles.some((role) => FINANCE.includes(role))) return { ...money, canManageMoney: true };
      return { ...money, movements: [], invoices: [], totals: [], canManageMoney: false };
    },

    /** multipart/form-data: kind, counterpartyId, amount, currency, fxRate, occurredOn, reference, notes?, file? (bank slip, optional). */
    async recordMovement(actor: ShipmentActor, projectId: unknown, form: FormData) {
      requireRole(actor, FINANCE);
      const kind = field(form, "kind") as MovementKind;
      if (!MOVEMENT_KINDS[kind]) throw invalid("Choose receipt from customer, payment to supplier, or a refund.");
      const cur = currency(field(form, "currency"));
      const input = {
        tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), kind,
        counterpartyId: id(field(form, "counterpartyId"), MOVEMENT_KINDS[kind].party === "CUSTOMER" ? "Customer" : "Supplier"),
        amount: amount(field(form, "amount")), currency: cur, fxRate: fxRate(field(form, "fxRate"), cur),
        occurredOn: date(field(form, "occurredOn"), "Date"), reference: text(field(form, "reference"), "Bank reference", 2, 80).toUpperCase(),
        notes: optionalText(field(form, "notes"), "Notes", 500),
      };
      const file = form.get("file");
      const hasFile = file instanceof File && file.size > 0;
      return guarded(async () => store.recordMovement({ ...input, document: hasFile ? await documentOf(form, "bank slip or transfer confirmation") : null }));
    },

    async allocate(actor: ShipmentActor, movementId: unknown, body: unknown) {
      requireRole(actor, FINANCE);
      const b = (body ?? {}) as Record<string, unknown>;
      if (b.targetType !== "CINV" && b.targetType !== "SUPPLIER_INVOICE") throw invalid("Choose the invoice to pay.");
      return guarded(() => store.allocate({ tenantId: actor.tenantId, actorId: actor.userId, movementId: id(movementId, "Payment"), targetType: b.targetType as "CINV" | "SUPPLIER_INVOICE", targetId: id(b.targetId, "Invoice"), amount: amount(b.amount), currency: currency(b.currency) }));
    },

    async reverseAllocation(actor: ShipmentActor, allocationId: unknown, body: unknown) {
      requireRole(actor, FINANCE);
      return guarded(() => store.reverseAllocation({ tenantId: actor.tenantId, actorId: actor.userId, allocationId: id(allocationId, "Allocation"), reason: reason(body) }));
    },

    async reverseMovement(actor: ShipmentActor, movementId: unknown, body: unknown) {
      requireRole(actor, FINANCE);
      return guarded(() => store.reverseMovement({ tenantId: actor.tenantId, actorId: actor.userId, movementId: id(movementId, "Payment"), reason: reason(body) }));
    },

    /** multipart/form-data: categoryCode, supplierId? | payeeName?, description?, shipmentType?+shipmentId?, amount, currency, fxRate, occurredOn, file (bill). */
    async createExpense(actor: ShipmentActor, projectId: unknown, form: FormData) {
      requireRole(actor, EXPENSE_WRITERS);
      const cur = currency(field(form, "currency"));
      const supplierRaw = field(form, "supplierId");
      const supplierId = supplierRaw ? id(supplierRaw, "Supplier") : null;
      const payeeName = supplierId ? null : optionalText(field(form, "payeeName"), "Paid to", 120);
      if (!supplierId && (!payeeName || payeeName.length < 2)) throw invalid("Choose a supplier or type who was paid.");
      const shipmentType = field(form, "shipmentType"), shipmentId = field(form, "shipmentId");
      const shipment = shipmentId ? { type: shipmentType === "SALES" ? "SALES" as const : "SUPPLIER" as const, id: id(shipmentId, "Shipment") } : null;
      const input = {
        tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"),
        categoryCode: text(field(form, "categoryCode"), "Category", 2, 40), supplierId, payeeName, description: optionalText(field(form, "description"), "Description", 300), shipment,
        amount: amount(field(form, "amount")), currency: cur, fxRate: fxRate(field(form, "fxRate"), cur), occurredOn: date(field(form, "occurredOn"), "Expense date"),
      };
      return guarded(async () => store.createExpense({ ...input, document: await documentOf(form, "bill or receipt") }));
    },

    async cancelExpense(actor: ShipmentActor, expenseId: unknown, body: unknown) {
      requireRole(actor, FINANCE);
      return guarded(() => store.cancelExpense({ tenantId: actor.tenantId, actorId: actor.userId, expenseId: id(expenseId, "Expense"), reason: reason(body) }));
    },

    async listApprovals(actor: ShipmentActor) {
      if (!actor.roles.includes("OWNER_ADMIN")) return [];
      return store.listPendingApprovals(actor.tenantId);
    },

    /** Owner decision from the approvals inbox. Returns null when the approval is not a money one. */
    async decide(actor: ShipmentActor, approvalId: string, body: { decision: "APPROVED" | "REJECTED"; comment: string | null }) {
      const subject = await store.approvalSubject(actor.tenantId, approvalId);
      if (!subject) return null;
      requireRole(actor, ["OWNER_ADMIN"]);
      if (body.decision === "REJECTED" && (!body.comment || body.comment.trim().length < 3)) throw invalid("Say what needs to be corrected.");
      const input = { tenantId: actor.tenantId, approvalId, approverId: actor.userId, decision: body.decision, comment: body.comment };
      return guarded(async () => subject.type === "MOVEMENT"
        ? { subjectType: "MONEY_MOVEMENT" as const, movement: await store.decideMovement({ ...input, movementId: subject.id }) }
        : { subjectType: "EXPENSE" as const, expense: await store.decideExpense({ ...input, expenseId: subject.id }) });
    },
  });
}

export type MoneyService = ReturnType<typeof createMoneyService>;
