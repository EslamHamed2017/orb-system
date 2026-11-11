import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../access/permissions.ts";

type Principal = OperationPrincipal;
type Shipment = Readonly<{ id: string; projectId: string; customerId: string; customerNameEn: string; customerNameAr: string; reference: string; activeDatasetId: string; executionState: string; version: number }>;
type DatasetLine = Readonly<{ id: string; lineNo: number; productDescription: string; quantity: string }>;
type Dataset = Readonly<{ id: string; shipmentId: string; state: string; lines: readonly DatasetLine[] }>;
type InvoiceLine = Readonly<{ id: string; lineNo: number; salesShipmentDatasetLineId: string; description: string; quantity: string; unitPrice: string; lineAmount: string }>;
export type SalesInvoice = Readonly<{ id: string; projectId: string; salesShipmentId: string; salesShipmentDatasetId: string; customerId: string; reference: string; invoiceDate: string; currency: string; state: "DRAFT" | "ISSUED" | "CANCELLED"; totalAmount: string; version: number; lines: readonly InvoiceLine[] }>;
type State = { shipments: Map<string, Shipment>; datasets: Map<string, Dataset>; invoices: Map<string, SalesInvoice>; replay: Map<string, { hash: string; value: SalesInvoice }> };
export interface SalesInvoiceService {
  create(input: Record<string, unknown>): Promise<{ value: SalesInvoice; replayed: boolean }>;
  get(input: { invoiceId: string; principal: Principal }): Promise<SalesInvoice>;
  getPrintData(input: { invoiceId: string; principal: Principal; locale?: string }): Promise<any>;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId: correlationId as ReturnType<typeof randomUUID> }); }
function authorize(principal: Principal | undefined, operationId: "createSalesInvoice" | "getSalesInvoice" | "getSalesInvoicePrintData", correlationId: string): Principal { try { assertServerPermission(principal as Principal, operationId); } catch { fail("PERMISSION_DENIED", 403, correlationId); } return principal as Principal; }
function decimal(value: unknown, correlationId: string): DecimalAmount { try { if (typeof value !== "string") throw new TypeError(); const parsed = DecimalAmount.parse(value); if (parsed.isNegative() || parsed.isZero() || parsed.scale > 6) throw new TypeError(); return parsed; } catch { fail("VALIDATION_FAILED", 400, correlationId); } }
function six(value: DecimalAmount): string { const [whole, fraction = ""] = value.toString().split("."); return `${whole}.${fraction.padEnd(6, "0")}`; }

export function createInMemorySalesInvoiceService(options: { now: () => string; shipments: readonly Shipment[]; datasets: readonly Dataset[] }): SalesInvoiceService {
  const state: State = { shipments: new Map(options.shipments.map((row) => [row.id, clone(row)])), datasets: new Map(options.datasets.map((row) => [row.id, clone(row)])), invoices: new Map(), replay: new Map() };
  function current(invoiceId: string, correlationId: string) { const invoice = state.invoices.get(invoiceId); if (!invoice) fail("RESOURCE_NOT_FOUND", 404, correlationId); return invoice; }
  return {
    async create(input) {
      const correlationId = typeof input.correlationId === "string" ? input.correlationId : randomUUID();
      const principal = authorize(input.principal as Principal | undefined, "createSalesInvoice", correlationId);
      if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8) fail("VALIDATION_FAILED", 400, correlationId);
      const request = Object.fromEntries(Object.entries(input).filter(([key]) => !["principal", "correlationId", "idempotencyKey"].includes(key)));
      const replayKey = `${principal.userId}:createSalesInvoice:${input.idempotencyKey}`, requestHash = hash(request), prior = state.replay.get(replayKey);
      if (prior) { if (prior.hash !== requestHash) fail("IDEMPOTENCY_KEY_REUSED", 409, correlationId); return { value: clone(prior.value), replayed: true }; }
      const shipment = state.shipments.get(String(input.shipmentId));
      if (!shipment) fail("RESOURCE_NOT_FOUND", 404, correlationId);
      if (input.expectedVersion !== shipment.version) fail("STALE_VERSION", 412, correlationId);
      if (!new Set(["CONFIRMED", "IN_TRANSIT", "DELIVERED"]).has(shipment.executionState)) fail("INVALID_STATE_TRANSITION", 409, correlationId);
      if ([...state.invoices.values()].some((invoice) => invoice.salesShipmentId === shipment.id && invoice.state !== "CANCELLED")) fail("ACTIVE_INVOICE_EXISTS", 409, correlationId);
      const dataset = state.datasets.get(shipment.activeDatasetId);
      const reference = typeof input.reference === "string" ? input.reference.trim() : "";
      if (!dataset || dataset.shipmentId !== shipment.id || dataset.state !== "APPROVED" || !reference || !DATE.test(String(input.invoiceDate)) || !CURRENCY.test(String(input.currency)) || !Array.isArray(input.lines) || input.lines.length === 0) fail("VALIDATION_FAILED", 400, correlationId);
      if ([...state.invoices.values()].some((invoice) => invoice.customerId === shipment.customerId && invoice.reference === reference)) fail("DUPLICATE_REFERENCE", 409, correlationId);
      const sourceById = new Map(dataset.lines.map((line) => [line.id, line])), seen = new Set<string>(); let total = DecimalAmount.parse("0");
      const lines = input.lines.map((raw, index): InvoiceLine => {
        if (!raw || typeof raw !== "object") fail("VALIDATION_FAILED", 400, correlationId);
        const item = raw as Record<string, unknown>, source = sourceById.get(String(item.shipmentLineId));
        if (!source || seen.has(source.id) || typeof item.description !== "string" || !item.description.trim()) fail("VALIDATION_FAILED", 400, correlationId);
        seen.add(source.id); const quantity = decimal(item.quantity, correlationId), unitPrice = decimal(item.unitPrice, correlationId);
        if (quantity.compare(decimal(source.quantity, correlationId)) > 0) fail("VALIDATION_FAILED", 400, correlationId);
        const amount = quantity.multiply(unitPrice); if (amount.scale > 6) fail("VALIDATION_FAILED", 400, correlationId); total = total.add(amount);
        return Object.freeze({ id: randomUUID(), lineNo: index + 1, salesShipmentDatasetLineId: source.id, description: item.description.trim(), quantity: six(quantity), unitPrice: six(unitPrice), lineAmount: six(amount) });
      });
      const invoice: SalesInvoice = Object.freeze({ id: randomUUID(), projectId: shipment.projectId, salesShipmentId: shipment.id, salesShipmentDatasetId: dataset.id, customerId: shipment.customerId, reference, invoiceDate: String(input.invoiceDate), currency: String(input.currency), state: "DRAFT", totalAmount: six(total), version: 1, lines: Object.freeze(lines) });
      state.invoices.set(invoice.id, invoice); state.replay.set(replayKey, { hash: requestHash, value: clone(invoice) }); return { value: clone(invoice), replayed: false };
    },
    async get(input) { authorize(input.principal, "getSalesInvoice", `get-${input.invoiceId}`); return clone(current(input.invoiceId, `get-${input.invoiceId}`)); },
    async getPrintData(input) {
      authorize(input.principal, "getSalesInvoicePrintData", `print-${input.invoiceId}`); const invoice = current(input.invoiceId, `print-${input.invoiceId}`), shipment = state.shipments.get(invoice.salesShipmentId)!; const ar = input.locale === "ar";
      return Object.freeze({ invoice: clone(invoice), title: ar ? "فاتورة مبيعات" : "Sales invoice", direction: ar ? "rtl" : "ltr", customer: { id: shipment.customerId, name: ar ? shipment.customerNameAr : shipment.customerNameEn }, shipment: { id: shipment.id, reference: shipment.reference }, lines: clone(invoice.lines), totals: { currency: invoice.currency, totalAmount: invoice.totalAmount }, generatedAt: options.now() });
    },
  };
}
