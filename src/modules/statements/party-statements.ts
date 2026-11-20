import type { SqlClient } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { companyDocumentProfile, type CompanyDocumentProfile } from "../invoices/invoice-store.ts";

/**
 * Statements of account, like QuickBooks' customer and supplier statements: every invoice and payment with a running
 * balance per currency, what is still open by age, and payments not yet matched. Owner and Finance only.
 *   customer: + issued invoices (with VAT) + refunds paid to the customer − money received
 *   supplier: + confirmed supplier invoices + refunds received from the supplier − payments made
 */
export interface StatementLine { readonly date: string; readonly type: string; readonly reference: string; readonly projectReference: string; readonly dueDate: string | null; readonly charge: string; readonly payment: string; readonly balance: string }
export interface StatementSection {
  readonly currency: string; readonly opening: string; readonly lines: readonly StatementLine[]; readonly closing: string;
  readonly aging: { readonly current: string; readonly days1to30: string; readonly days31to60: string; readonly days61to90: string; readonly over90: string };
  readonly unappliedPayments: string;
}
export interface PartyStatement {
  readonly type: "customer" | "supplier"; readonly asOf: string; readonly from: string | null; readonly company: CompanyDocumentProfile;
  readonly party: { readonly id: string; readonly reference: string; readonly name: string; readonly nameAr: string | null; readonly address: string | null; readonly taxNumber: string | null; readonly email: string | null; readonly paymentTermsDays: number };
  readonly sections: readonly StatementSection[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const m = (c: number) => (c / 100).toFixed(2);
const day = (v: unknown) => new Date(v as string).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

function formatAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).filter((v) => typeof v === "string" && v.trim()).join(", ") || null;
  return null;
}

export function createPartyStatements(client: SqlClient) {
  return Object.freeze({
    async statement(actor: ShipmentActor, type: string, subjectId: string, query: { asOf?: string | null; from?: string | null }): Promise<PartyStatement> {
      if (!actor.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Statements are for owners and finance.");
      if (type !== "customer" && type !== "supplier") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", "Statements are available for customers and suppliers.");
      if (!UUID.test(subjectId)) throw new ShipmentProblem(422, "VALIDATION_FAILED", "Not a valid id.");
      const asOf = query.asOf && DATE.test(query.asOf) ? query.asOf : new Date().toISOString().slice(0, 10);
      const from = query.from && DATE.test(query.from) ? query.from : null;
      const t = actor.tenantId;
      const party = type === "customer"
        ? (await client.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT "id"::text id, "reference", "legal_name" name, "legal_name_ar" name_ar, "billing_address" address, "tax_registration_number" tax, "email", "payment_terms_days" terms FROM "Customer" WHERE "tenant_id" = $1 AND "id" = $2`, t, subjectId))[0]
        : (await client.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT "id"::text id, "reference", "registered_name" name, "display_name_ar" name_ar, NULL address, NULL tax, "email", "payment_terms_days" terms FROM "Supplier" WHERE "tenant_id" = $1 AND "id" = $2`, t, subjectId))[0];
      if (!party) throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", type === "customer" ? "Customer not found" : "Supplier not found");
      const terms = Number(party.terms ?? 0);

      const invoices = type === "customer"
        ? await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT i."id"::text id, i."reference", i."invoice_date" d, btrim(i."currency") currency, p."reference" project,
                  ((SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id") + i."vat_amount")::text amount,
                  COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'CINV' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text settled
             FROM "SalesInvoice" i JOIN "Project" p ON p."id" = i."project_id"
            WHERE i."tenant_id" = $1 AND i."customer_master_id" = $2 AND i."state"::text = 'ISSUED' AND i."invoice_date" <= $3::date`, t, subjectId, asOf)
        : await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT i."id"::text id, i."reference", i."invoice_date" d, btrim(i."currency") currency, p."reference" project, i."amount"::text amount,
                  COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'SUPPLIER_INVOICE' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text settled
             FROM "SupplierInvoice" i JOIN "Project" p ON p."id" = i."project_id"
            WHERE i."tenant_id" = $1 AND i."supplier_master_id" = $2 AND i."state"::text = 'CONFIRMED' AND i."invoice_date" <= $3::date`, t, subjectId, asOf);
      const movements = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT m."id"::text id, m."kind"::text kind, m."reference", m."occurred_on" d, btrim(m."currency") currency, m."amount"::text amount, p."reference" project,
                COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."movement_id" = m."id" AND a."state" = 'ACTIVE'), 0)::text allocated
           FROM "MoneyMovement" m JOIN "Project" p ON p."id" = m."project_id"
          WHERE m."tenant_id" = $1 AND ${type === "customer" ? `m."customer_master_id"` : `m."supplier_master_id"`} = $2
            AND m."state"::text IN ('CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED') AND m."occurred_on" <= $3::date`, t, subjectId, asOf);

      type Entry = { date: string; type: string; reference: string; project: string; due: string | null; charge: number; payment: number; currency: string };
      const entries: Entry[] = [];
      for (const i of invoices) {
        const d = day(i.d);
        entries.push({ date: d, type: type === "customer" ? "INVOICE" : "BILL", reference: String(i.reference), project: String(i.project), due: addDays(d, terms), charge: cents(i.amount), payment: 0, currency: String(i.currency) });
      }
      const chargeKinds = type === "customer" ? ["CUSTOMER_REFUND"] : ["SUPPLIER_REFUND"];
      for (const mv of movements) {
        const charge = chargeKinds.includes(String(mv.kind));
        entries.push({ date: day(mv.d), type: String(mv.kind), reference: String(mv.reference), project: String(mv.project), due: null, charge: charge ? cents(mv.amount) : 0, payment: charge ? 0 : cents(mv.amount), currency: String(mv.currency) });
      }
      const currencies = [...new Set(entries.map((e) => e.currency))].sort();
      const sections: StatementSection[] = currencies.map((currency) => {
        const rows = entries.filter((e) => e.currency === currency).sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));
        const opening = rows.filter((e) => from && e.date < from).reduce((total, e) => total + e.charge - e.payment, 0);
        let running = opening;
        const lines = rows.filter((e) => !from || e.date >= from).map((e) => {
          running += e.charge - e.payment;
          return { date: e.date, type: e.type, reference: e.reference, projectReference: e.project, dueDate: e.due, charge: e.charge ? m(e.charge) : "", payment: e.payment ? m(e.payment) : "", balance: m(running) };
        });
        const buckets = [0, 0, 0, 0, 0];
        for (const i of invoices.filter((x) => String(x.currency) === currency)) {
          const open = cents(i.amount) - cents(i.settled);
          if (open <= 0) continue;
          const late = daysBetween(addDays(day(i.d), terms), asOf);
          buckets[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4] += open;
        }
        const payKinds = type === "customer" ? ["CUSTOMER_RECEIPT"] : ["SUPPLIER_PAYMENT"];
        const unapplied = movements.filter((x) => String(x.currency) === currency && payKinds.includes(String(x.kind))).reduce((total, x) => total + cents(x.amount) - cents(x.allocated), 0);
        return { currency, opening: m(opening), lines, closing: m(running), unappliedPayments: m(unapplied),
          aging: { current: m(buckets[0]), days1to30: m(buckets[1]), days31to60: m(buckets[2]), days61to90: m(buckets[3]), over90: m(buckets[4]) } };
      });
      return {
        type, asOf, from, company: await companyDocumentProfile(client, t),
        party: { id: String(party.id), reference: String(party.reference), name: String(party.name), nameAr: party.name_ar ? String(party.name_ar) : null, address: formatAddress(party.address),
          taxNumber: party.tax ? String(party.tax) : null, email: party.email ? String(party.email) : null, paymentTermsDays: terms },
        sections,
      };
    },
  });
}
