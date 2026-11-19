// @ts-expect-error Native Node TypeScript tests require source extensions.
import { InvoiceStoreError, type InvoiceType, type PrismaInvoiceStore } from "./invoice-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DocumentStorageError, readDocument } from "../evidence/document-storage.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

type InvoiceStore = Pick<PrismaInvoiceStore, keyof PrismaInvoiceStore>;

/** Invoices are the finance role's work (roles.ts): Owner administrator and Finance. */
const FINANCE = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const READ = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/;

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
function invoiceDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw invalid("Invoice date must be a date (YYYY-MM-DD).");
  const date = Date.parse(`${value}T00:00:00Z`);
  if (date > Date.now() + 86_400_000) throw invalid("Invoice date cannot be in the future.");
  if (date < Date.parse("2000-01-01T00:00:00Z")) throw invalid("Invoice date is too old.");
  return value;
}

function translate(error: unknown): never {
  if (error instanceof InvoiceStoreError) {
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

export function createInvoiceService(store: InvoiceStore) {
  return Object.freeze({
    async listForShipment(actor: ShipmentActor, type: InvoiceType, shipmentId: string) {
      requireRole(actor, READ);
      return store.listForShipment(actor.tenantId, type, shipmentId);
    },

    /** multipart/form-data: file, reference, invoiceDate, amount (as printed on the supplier's invoice). */
    async createSupplierInvoice(actor: ShipmentActor, shipmentId: unknown, form: FormData) {
      requireRole(actor, FINANCE);
      const amountRaw = String(form.get("amount") ?? "").trim().replaceAll(",", "");
      if (!AMOUNT.test(amountRaw) || Number(amountRaw) <= 0) throw invalid("Amount must be a positive number with up to 2 decimals.");
      const input = {
        shipmentId: id(shipmentId, "Shipment"),
        reference: text(form.get("reference"), "Supplier invoice number", 1, 64).toUpperCase(),
        invoiceDate: invoiceDate(form.get("invoiceDate")),
        amount: amountRaw,
      };
      try {
        const document = await readDocument(form.get("file"));
        return await store.createSupplierInvoice({ tenantId: actor.tenantId, actorId: actor.userId, ...input, document });
      } catch (error) { translate(error); }
    },

    async submitSupplierInvoice(actor: ShipmentActor, invoiceId: unknown) {
      requireRole(actor, FINANCE);
      try { return await store.submitSupplierInvoice({ tenantId: actor.tenantId, actorId: actor.userId, invoiceId: id(invoiceId, "Invoice") }); } catch (error) { translate(error); }
    },

    async confirmSupplierInvoice(actor: ShipmentActor, invoiceId: unknown) {
      requireRole(actor, FINANCE);
      let invoice;
      try { invoice = await store.get(actor.tenantId, "SUPPLIER", id(invoiceId, "Invoice")); } catch (error) { translate(error); }
      if (invoice.state !== "CONFIRMED") {
        throw new ShipmentProblem(409, "APPROVAL_REQUIRED", invoice.state === "PENDING_APPROVAL" ? "Waiting for the owner's approval." : "Submit the invoice for approval first.");
      }
      return invoice;
    },

    async cancelSupplierInvoice(actor: ShipmentActor, invoiceId: unknown, body: Record<string, unknown>) {
      requireRole(actor, FINANCE);
      const reason = text(body.reason, "Reason", 3, 500);
      try { return await store.cancelSupplierInvoice({ tenantId: actor.tenantId, actorId: actor.userId, invoiceId: id(invoiceId, "Invoice"), reason }); } catch (error) { translate(error); }
    },

    async decideSupplierInvoice(actor: ShipmentActor, approvalId: string, body: Record<string, unknown>) {
      requireRole(actor, ["OWNER_ADMIN"]);
      const decision = body.decision;
      if (decision !== "APPROVED" && decision !== "REJECTED") throw invalid("decision must be APPROVED or REJECTED.");
      const comment = decision === "REJECTED" ? text(body.comment, "Rejection reason", 3, 500) : (typeof body.comment === "string" && body.comment.trim() ? body.comment.trim().slice(0, 500) : null);
      try { return await store.decideSupplierInvoice({ tenantId: actor.tenantId, approvalId, approverId: actor.userId, decision, comment }); } catch (error) { translate(error); }
    },

    async issueSalesInvoice(actor: ShipmentActor, shipmentId: unknown, body: Record<string, unknown>) {
      requireRole(actor, FINANCE);
      const input = { shipmentId: id(shipmentId, "Shipment"), invoiceDate: invoiceDate(body.invoiceDate ?? new Date().toISOString().slice(0, 10)) };
      try { return await store.issueSalesInvoice({ tenantId: actor.tenantId, actorId: actor.userId, ...input }); } catch (error) { translate(error); }
    },

    async getSalesInvoice(actor: ShipmentActor, invoiceId: unknown) {
      requireRole(actor, FINANCE);
      try { return await store.get(actor.tenantId, "SALES", id(invoiceId, "Invoice")); } catch (error) { translate(error); }
    },

    async salesInvoicePrintData(actor: ShipmentActor, invoiceId: unknown) {
      requireRole(actor, FINANCE);
      try { return await store.printData(actor.tenantId, id(invoiceId, "Invoice")); } catch (error) { translate(error); }
    },

    async cancelSalesInvoice(actor: ShipmentActor, invoiceId: unknown, body: Record<string, unknown>) {
      requireRole(actor, FINANCE);
      const reason = text(body.reason, "Reason", 3, 500);
      try { return await store.cancelSalesInvoice({ tenantId: actor.tenantId, actorId: actor.userId, invoiceId: id(invoiceId, "Invoice"), reason }); } catch (error) { translate(error); }
    },
  });
}

export type InvoiceService = ReturnType<typeof createInvoiceService>;
