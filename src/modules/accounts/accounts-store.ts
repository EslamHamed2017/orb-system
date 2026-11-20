import type { SqlClient } from "../shipments/execution/shipment-execution-store.ts";

/**
 * Company-wide operational accounts from the database, always scoped to the signed-in company.
 * Records: customer invoices, supplier invoices, collections (customer receipts), supplier payments and expenses.
 * "Outstanding" is what is still unpaid on an invoice, or still unmatched on a receipt/payment. Not a general ledger.
 */
export type AccountRecordType = "SALES_INVOICE" | "SUPPLIER_INVOICE" | "COLLECTION" | "SUPPLIER_PAYMENT" | "EXPENSE";

export interface AccountRecord {
  readonly id: string; readonly projectId: string; readonly type: AccountRecordType; readonly occurredOn: string; readonly state: string;
  readonly partyId?: string; readonly reference: string; readonly currency: string; readonly amount: string; readonly outstandingAmount: string;
  readonly projectReference: string; readonly partyName: string; readonly documentId: string | null; readonly href: string;
}

export interface AccountsCurrencySummary {
  readonly currency: string; readonly salesInvoiced: string; readonly salesOutstanding: string; readonly supplierInvoiced: string; readonly supplierOutstanding: string;
  readonly collections: string; readonly supplierPayments: string; readonly expenses: string; readonly netOperationalCash: string;
}

const dec = (cents: number) => (cents / 100).toFixed(6);
const c = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const day = (value: unknown) => new Date(value as string).toISOString().slice(0, 10);
const LIVE_MOVEMENT = `('CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED')`;

const QUERIES: Record<AccountRecordType, string> = {
  SALES_INVOICE: `
    SELECT i."id"::text AS id, i."project_id"::text AS project_id, p."reference" AS project_reference, i."invoice_date" AS occurred_on, i."state"::text AS state, i."reference" AS reference,
           btrim(i."currency") AS currency, i."customer_master_id"::text AS party_id, c."legal_name" AS party_name, NULL::text AS document_id, '/sales-shipments/' || i."sales_shipment_id" AS href,
           COALESCE((SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id"), 0)::text AS amount,
           COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'CINV' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text AS settled
      FROM "SalesInvoice" i JOIN "Project" p ON p."id" = i."project_id" JOIN "Customer" c ON c."id" = i."customer_master_id"
     WHERE i."tenant_id" = $1 AND ($2::uuid IS NULL OR i."project_id" = $2::uuid)`,
  SUPPLIER_INVOICE: `
    SELECT i."id"::text AS id, i."project_id"::text AS project_id, p."reference" AS project_reference, i."invoice_date" AS occurred_on, i."state"::text AS state, i."reference" AS reference, btrim(i."currency") AS currency, i."supplier_master_id"::text AS party_id, s."registered_name" AS party_name,
           (SELECT l."evidence_id"::text FROM "EvidenceLink" l WHERE l."subject_type" = 'SUPPLIER_INVOICE' AND l."subject_id" = i."id" ORDER BY l."id" LIMIT 1) AS document_id, '/supplier-shipments/' || i."supplier_shipment_id" AS href,
           i."amount"::text AS amount,
           COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'SUPPLIER_INVOICE' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text AS settled
      FROM "SupplierInvoice" i JOIN "Project" p ON p."id" = i."project_id" JOIN "Supplier" s ON s."id" = i."supplier_master_id"
     WHERE i."tenant_id" = $1 AND ($2::uuid IS NULL OR i."project_id" = $2::uuid)`,
  COLLECTION: movement("CUSTOMER_RECEIPT"),
  SUPPLIER_PAYMENT: movement("SUPPLIER_PAYMENT"),
  EXPENSE: `
    SELECT x."id"::text AS id, x."project_id"::text AS project_id, p."reference" AS project_reference, x."occurred_on" AS occurred_on, x."state"::text AS state, k."name_en" AS reference, btrim(x."currency") AS currency, x."supplier_master_id"::text AS party_id, COALESCE(s."registered_name", x."payee_name") AS party_name,
           x."evidence_id"::text AS document_id, '/projects/' || x."project_id" || '/expenses' AS href, x."amount"::text AS amount, x."amount"::text AS settled
      FROM "DirectExpense" x JOIN "Project" p ON p."id" = x."project_id" JOIN "ExpenseCategory" k ON k."code" = x."category_code" LEFT JOIN "Supplier" s ON s."id" = x."supplier_master_id"
     WHERE x."tenant_id" = $1 AND ($2::uuid IS NULL OR x."project_id" = $2::uuid)`,
};

function movement(kind: string) {
  return `
    SELECT m."id"::text AS id, m."project_id"::text AS project_id, p."reference" AS project_reference, m."occurred_on" AS occurred_on, m."state"::text AS state, m."reference" AS reference, btrim(m."currency") AS currency, COALESCE(m."customer_master_id", m."supplier_master_id")::text AS party_id,
           COALESCE(c."legal_name", s."registered_name") AS party_name, m."evidence_id"::text AS document_id, '/projects/' || m."project_id" || '/money' AS href, m."amount"::text AS amount,
           COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."movement_id" = m."id" AND a."state" = 'ACTIVE'), 0)::text AS settled
      FROM "MoneyMovement" m JOIN "Project" p ON p."id" = m."project_id" LEFT JOIN "Customer" c ON c."id" = m."customer_master_id" LEFT JOIN "Supplier" s ON s."id" = m."supplier_master_id"
     WHERE m."tenant_id" = $1 AND m."kind"::text = '${kind}' AND ($2::uuid IS NULL OR m."project_id" = $2::uuid)`;
}

/** What is still open on a record: unpaid invoice balance, unmatched receipt/payment, nothing on expenses or closed records. */
function outstanding(type: AccountRecordType, state: string, amount: number, settled: number) {
  if (type === "SALES_INVOICE") return state === "ISSUED" ? amount - settled : 0;
  if (type === "SUPPLIER_INVOICE") return state === "CONFIRMED" ? amount - settled : 0;
  if (type === "EXPENSE") return 0;
  return ["CONFIRMED", "PARTIALLY_ALLOCATED"].includes(state) ? amount - settled : 0;
}

export class PrismaAccountsStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async list(tenantId: string, type: AccountRecordType, projectId: string | null): Promise<AccountRecord[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(`${QUERIES[type]} ORDER BY 4 DESC, 1 DESC`, tenantId, projectId);
    return rows.map((r) => {
      const { id, project_id: project, project_reference: projectReference, occurred_on: occurredOn, state, reference, currency, party_id: partyId, party_name: partyName, document_id: documentId, href, amount, settled } = r;
      return {
        id: String(id), projectId: String(project), type, occurredOn: day(occurredOn), state: String(state), ...(partyId ? { partyId: String(partyId) } : {}),
        reference: String(reference), currency: String(currency), amount: dec(c(amount)), outstandingAmount: dec(outstanding(type, String(state), c(amount), c(settled))),
        projectReference: String(projectReference), partyName: String(partyName ?? ""), documentId: documentId ? String(documentId) : null, href: String(href),
      };
    });
  }

  async summary(tenantId: string, projectId: string | null): Promise<{ recordCount: number; currencySections: AccountsCurrencySummary[] }> {
    const types: AccountRecordType[] = ["SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE"];
    const all = (await Promise.all(types.map((t) => this.list(tenantId, t, projectId)))).flat();
    const by = new Map<string, Record<string, number>>();
    const add = (cur: string, key: string, value: number) => { const x = by.get(cur) ?? {}; x[key] = (x[key] ?? 0) + value; by.set(cur, x); };
    for (const r of all) {
      const amount = c(r.amount), open = c(r.outstandingAmount);
      if (r.type === "SALES_INVOICE" && r.state === "ISSUED") { add(r.currency, "salesInvoiced", amount); add(r.currency, "salesOutstanding", open); }
      if (r.type === "SUPPLIER_INVOICE" && r.state === "CONFIRMED") { add(r.currency, "supplierInvoiced", amount); add(r.currency, "supplierOutstanding", open); }
      if (r.type === "COLLECTION" && LIVE_MOVEMENT.includes(`'${r.state}'`)) add(r.currency, "collections", amount);
      if (r.type === "SUPPLIER_PAYMENT" && LIVE_MOVEMENT.includes(`'${r.state}'`)) add(r.currency, "supplierPayments", amount);
      if (r.type === "EXPENSE" && r.state === "APPROVED") add(r.currency, "expenses", amount);
      if (!by.has(r.currency)) by.set(r.currency, {});
    }
    const currencySections = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, x]) => ({
      currency, salesInvoiced: dec(x.salesInvoiced ?? 0), salesOutstanding: dec(x.salesOutstanding ?? 0), supplierInvoiced: dec(x.supplierInvoiced ?? 0),
      supplierOutstanding: dec(x.supplierOutstanding ?? 0), collections: dec(x.collections ?? 0), supplierPayments: dec(x.supplierPayments ?? 0), expenses: dec(x.expenses ?? 0),
      netOperationalCash: dec((x.collections ?? 0) - (x.supplierPayments ?? 0) - (x.expenses ?? 0)),
    }));
    return { recordCount: all.length, currencySections };
  }
}
