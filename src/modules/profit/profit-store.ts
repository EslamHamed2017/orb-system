import type { SqlClient } from "../shipments/execution/shipment-execution-store.ts";

/**
 * Project profit from the database, in the project's currency with AED beside it.
 *
 *   Expected = sales contract value − purchase contract values          (active contract versions: quantity × unit price)
 *   Shipped  = confirmed customer shipments at the sales price
 *              − the same quantities at the purchase price of each shipment's source supplier shipment
 *   Actual   = issued customer invoices − approved supplier invoices − approved expenses
 *              − settled customer claims (they lower revenue) + settled supplier claims (they lower cost)
 *   Cash     = received from the customer − refunds to the customer − paid to suppliers + refunds from suppliers
 *
 * Currency: documents in the project currency count as they are. Documents in another currency are converted
 * through AED: money movements and expenses carry their own bank rate to AED; AED documents use the project rate.
 * The project rate (AED per unit of project currency) is the amount-weighted average of the bank rates recorded on
 * the project's own receipts, payments and expenses; without any, USD uses the official peg 3.6725.
 * Anything that cannot be converted is listed as not included, never guessed.
 */

export const PROFIT_FORMULA_VERSION = "orb-profit-2026-11";
const USD_AED_PEG = 3.6725;

export type MeasureKey = "expected" | "shipped" | "actual" | "cash";

export interface ProfitSource {
  readonly measure: MeasureKey;
  readonly kind: "SALES_CONTRACT" | "PURCHASE_CONTRACT" | "SALES_SHIPMENT" | "SALES_SHIPMENT_COST" | "CUSTOMER_INVOICE" | "SUPPLIER_INVOICE" | "EXPENSE" | "CUSTOMER_CLAIM" | "SUPPLIER_CLAIM"
    | "CUSTOMER_RECEIPT" | "CUSTOMER_REFUND" | "SUPPLIER_PAYMENT" | "SUPPLIER_REFUND";
  readonly id: string;
  readonly reference: string;
  readonly description: string;
  readonly sign: 1 | -1;
  readonly amount: string;
  readonly currency: string;
  readonly projectAmount: string | null;
  readonly aedAmount: string | null;
  readonly href: string | null;
}

export interface Measure {
  readonly key: MeasureKey;
  readonly amount: string;
  readonly aedAmount: string | null;
  readonly revenue: string;
  readonly cost: string;
  readonly marginPercent: string | null;
  readonly formula: string;
  readonly notIncluded: number;
}

export interface ProjectProfit {
  readonly project: { readonly id: string; readonly reference: string; readonly customerName: string; readonly lifecycleState: string; readonly currency: string };
  readonly rate: { readonly aedPerUnit: string | null; readonly source: "AED" | "RECORDED_AVERAGE" | "USD_PEG" | "UNAVAILABLE" };
  readonly measures: Readonly<Record<MeasureKey, Measure>>;
  readonly sources: readonly ProfitSource[];
  readonly warnings: readonly string[];
  readonly formulaVersion: string;
}

const cents = (value: number) => Math.round(value * 100);
const two = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

const FORMULAS: Record<MeasureKey, string> = {
  expected: "Sales contract value − purchase contract values (quantity × unit price of the active versions)",
  shipped: "Confirmed customer shipments × sales price − the same quantities × purchase price of their source supplier shipments",
  actual: "Issued customer invoices − approved supplier invoices − approved expenses − settled customer claims + settled supplier claims",
  cash: "Received from customer − refunds to customer − paid to suppliers + refunds from suppliers",
};

export class PrismaProfitStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async listProjectIds(tenantId: string): Promise<string[]> {
    return (await this.client.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"::text id FROM "Project" WHERE "tenant_id" = $1 AND "lifecycle_state"::text <> 'CANCELLED' ORDER BY "reference"`, tenantId)).map((r) => r.id);
  }

  async projectProfit(tenantId: string, projectId: string): Promise<ProjectProfit | null> {
    const q = <T>(sql: string, ...args: unknown[]) => this.client.$queryRawUnsafe<T[]>(sql, tenantId, projectId, ...args);
    const project = (await q<Record<string, string>>(
      `SELECT p."id", p."reference", p."lifecycle_state"::text lifecycle_state, btrim(p."management_currency") currency, c."legal_name" customer_name
         FROM "Project" p JOIN "Customer" c ON c."id" = p."customer_master_id" WHERE p."tenant_id" = $1 AND p."id" = $2`))[0];
    if (!project) return null;
    const X = project.currency;

    const [contracts, shipments, salesInvoices, supplierInvoices, expenses, movements, claims] = await Promise.all([
      q<Record<string, string>>(
        `SELECT k."id", k."kind"::text kind, k."reference", v."quantity"::text quantity, v."unit_price"::text unit_price, btrim(v."currency") currency, COALESCE(s."registered_name", '') supplier
           FROM "Contract" k JOIN "ContractVersion" v ON v."id" = k."active_version_id" LEFT JOIN "Supplier" s ON s."id" = k."counterparty_supplier_id"
          WHERE k."tenant_id" = $1 AND k."project_id" = $2 ORDER BY k."kind" DESC, k."reference"`),
      q<Record<string, string | null>>(
        `SELECT s."id", s."reference", d."quantity"::text quantity, sv."unit_price"::text sales_price, btrim(sv."currency") sales_currency,
                ss."id" source_id, ss."reference" source_reference, pv."unit_price"::text purchase_price, btrim(pv."currency") purchase_currency
           FROM "SalesShipment" s JOIN "SalesShipmentDataset" d ON d."id" = s."active_dataset_id"
           JOIN "ContractVersion" sv ON sv."id" = d."sales_contract_version_id"
           LEFT JOIN "SupplierShipment" ss ON ss."id" = s."primary_supplier_shipment_id"
           LEFT JOIN "SupplierShipmentDataset" sd ON sd."id" = ss."active_dataset_id"
           LEFT JOIN "ContractVersion" pv ON pv."id" = sd."purchase_contract_version_id"
          WHERE s."tenant_id" = $1 AND s."project_id" = $2 AND s."execution_state"::text IN ('CONFIRMED', 'IN_TRANSIT', 'DELIVERED') ORDER BY s."reference"`),
      q<Record<string, string>>(
        `SELECT i."id", i."reference", btrim(i."currency") currency, (SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id")::text amount, i."sales_shipment_id"::text shipment_id
           FROM "SalesInvoice" i WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text = 'ISSUED' ORDER BY i."reference"`),
      q<Record<string, string>>(
        `SELECT i."id", i."reference", btrim(i."currency") currency, i."amount"::text amount, s."registered_name" supplier, i."supplier_shipment_id"::text shipment_id
           FROM "SupplierInvoice" i JOIN "Supplier" s ON s."id" = i."supplier_master_id" WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text = 'CONFIRMED' ORDER BY i."reference"`),
      q<Record<string, string>>(
        `SELECT x."id", x."category_code", k."name_en" category, COALESCE(s."registered_name", x."payee_name") payee, x."state"::text state,
                btrim(x."currency") currency, x."amount"::text amount, x."aed_amount"::text aed_amount, x."fx_rate"::text fx_rate
           FROM "DirectExpense" x JOIN "ExpenseCategory" k ON k."code" = x."category_code" LEFT JOIN "Supplier" s ON s."id" = x."supplier_master_id"
          WHERE x."tenant_id" = $1 AND x."project_id" = $2 AND x."state"::text IN ('APPROVED', 'PENDING_APPROVAL') ORDER BY x."occurred_on", x."id"`),
      q<Record<string, string>>(
        `SELECT m."id", m."kind"::text kind, m."reference", m."state"::text state, btrim(m."currency") currency, m."amount"::text amount, m."aed_amount"::text aed_amount, m."fx_rate"::text fx_rate,
                COALESCE(c."legal_name", s."registered_name") party
           FROM "MoneyMovement" m LEFT JOIN "Customer" c ON c."id" = m."customer_master_id" LEFT JOIN "Supplier" s ON s."id" = m."supplier_master_id"
          WHERE m."tenant_id" = $1 AND m."project_id" = $2 AND m."state"::text IN ('CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED') ORDER BY m."occurred_on", m."id"`),
      q<Record<string, string>>(
        `SELECT c."id", c."side", c."state"::text state, c."settled_amount"::text amount, btrim(c."currency") currency,
                COALESCE(ss."reference", sp."reference") reference, COALESCE(cu."legal_name", su."registered_name") party
           FROM "Claim" c LEFT JOIN "SalesShipment" ss ON ss."id" = c."sales_shipment_id" LEFT JOIN "SupplierShipment" sp ON sp."id" = c."supplier_shipment_id"
           LEFT JOIN "Customer" cu ON cu."id" = c."customer_master_id" LEFT JOIN "Supplier" su ON su."id" = c."supplier_master_id"
          WHERE c."tenant_id" = $1 AND c."project_id" = $2 AND c."state"::text IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED') ORDER BY c."id"`),
    ]);

    // Project rate: AED per unit of the project currency.
    let rate: number | null = null;
    let rateSource: ProjectProfit["rate"]["source"] = "UNAVAILABLE";
    if (X === "AED") { rate = 1; rateSource = "AED"; } else {
      const recorded = [...movements, ...expenses.filter((x) => x.state === "APPROVED")].filter((r) => r.currency === X && Number(r.fx_rate) > 0);
      const weight = recorded.reduce((total, r) => total + Number(r.amount), 0);
      if (weight > 0) { rate = recorded.reduce((total, r) => total + Number(r.amount) * Number(r.fx_rate), 0) / weight; rateSource = "RECORDED_AVERAGE"; }
      else if (X === "USD") { rate = USD_AED_PEG; rateSource = "USD_PEG"; }
    }
    const toProject = (amount: number, currency: string, aed: number | null): number | null => {
      if (currency === X) return amount;
      if (!rate) return null;
      if (aed !== null && Number.isFinite(aed)) return aed / rate;
      if (currency === "AED") return amount / rate;
      return null;
    };
    const toAed = (amount: number, currency: string, aed: number | null): number | null => {
      if (aed !== null && Number.isFinite(aed)) return aed;
      if (currency === "AED") return amount;
      if (currency === X && rate) return amount * rate;
      return null;
    };

    const sources: ProfitSource[] = [];
    const warnings: string[] = [];
    const add = (measure: MeasureKey, kind: ProfitSource["kind"], sign: 1 | -1, row: { id: string; reference: string; description: string; amount: number; currency: string; aed?: number | null; href: string | null }) => {
      const aed = row.aed ?? null;
      const projectAmount = toProject(row.amount, row.currency, aed), aedAmount = toAed(row.amount, row.currency, aed);
      sources.push({ measure, kind, id: row.id, reference: row.reference, description: row.description, sign, amount: two(row.amount), currency: row.currency,
        projectAmount: projectAmount === null ? null : two(projectAmount), aedAmount: aedAmount === null ? null : two(aedAmount), href: row.href });
    };
    const pid = project.id;

    for (const k of contracts) {
      const value = Number(k.quantity) * Number(k.unit_price);
      if (k.kind === "SALES") add("expected", "SALES_CONTRACT", 1, { id: k.id, reference: k.reference, description: `${fmtQty(k.quantity)} MT × ${fmtPrice(k.unit_price)}`, amount: value, currency: k.currency, href: `/projects/${pid}/overview` });
      else add("expected", "PURCHASE_CONTRACT", -1, { id: k.id, reference: k.reference, description: `${k.supplier} · ${fmtQty(k.quantity)} MT × ${fmtPrice(k.unit_price)}`, amount: value, currency: k.currency, href: `/projects/${pid}/overview` });
    }
    for (const s of shipments) {
      const qty = Number(s.quantity);
      add("shipped", "SALES_SHIPMENT", 1, { id: String(s.id), reference: String(s.reference), description: `${fmtQty(String(s.quantity))} MT × ${fmtPrice(String(s.sales_price))}`, amount: qty * Number(s.sales_price), currency: String(s.sales_currency), href: `/sales-shipments/${s.id}` });
      if (s.source_id && s.purchase_price) {
        add("shipped", "SALES_SHIPMENT_COST", -1, { id: String(s.source_id), reference: String(s.source_reference), description: `${fmtQty(String(s.quantity))} MT × ${fmtPrice(String(s.purchase_price))} (source of ${s.reference})`, amount: qty * Number(s.purchase_price), currency: String(s.purchase_currency), href: `/supplier-shipments/${s.source_id}` });
      } else warnings.push(`Customer shipment ${s.reference} has no source supplier shipment, so its cost is not in Shipped.`);
    }
    for (const i of salesInvoices) add("actual", "CUSTOMER_INVOICE", 1, { id: i.id, reference: i.reference, description: "Issued customer invoice", amount: Number(i.amount), currency: i.currency, href: `/sales-shipments/${i.shipment_id}` });
    for (const i of supplierInvoices) add("actual", "SUPPLIER_INVOICE", -1, { id: i.id, reference: i.reference, description: `Approved supplier invoice · ${i.supplier}`, amount: Number(i.amount), currency: i.currency, href: `/supplier-shipments/${i.shipment_id}` });
    const pendingExpenses = expenses.filter((x) => x.state === "PENDING_APPROVAL");
    if (pendingExpenses.length) warnings.push(`${pendingExpenses.length} expense(s) are waiting for approval and are not in Actual yet.`);
    for (const x of expenses.filter((e) => e.state === "APPROVED")) add("actual", "EXPENSE", -1, { id: x.id, reference: x.category, description: x.payee, amount: Number(x.amount), currency: x.currency, aed: Number(x.aed_amount), href: `/projects/${pid}/expenses` });
    // A settled claim moves Actual: a customer claim lowers revenue, a supplier claim lowers cost.
    for (const c of claims.filter((r) => r.state === "RESOLVED" && Number(r.amount) > 0)) {
      if (c.side === "CUSTOMER") add("actual", "CUSTOMER_CLAIM", 1, { id: c.id, reference: c.reference, description: `Settled customer claim · ${c.party}`, amount: -Number(c.amount), currency: c.currency, href: `/projects/${pid}/claims` });
      else add("actual", "SUPPLIER_CLAIM", -1, { id: c.id, reference: c.reference, description: `Settled supplier claim · ${c.party}`, amount: -Number(c.amount), currency: c.currency, href: `/projects/${pid}/claims` });
    }
    const openClaims = claims.filter((r) => r.state !== "RESOLVED").length;
    if (openClaims) warnings.push(`${openClaims} claim(s) are still open and are not in Actual yet.`);
    const MOVES: Record<string, [ProfitSource["kind"], 1 | -1, string]> = {
      CUSTOMER_RECEIPT: ["CUSTOMER_RECEIPT", 1, "Received from"], CUSTOMER_REFUND: ["CUSTOMER_REFUND", -1, "Refunded to"],
      SUPPLIER_PAYMENT: ["SUPPLIER_PAYMENT", -1, "Paid to"], SUPPLIER_REFUND: ["SUPPLIER_REFUND", 1, "Refund from"],
    };
    for (const m of movements) {
      const rule = MOVES[m.kind];
      if (rule) add("cash", rule[0], rule[1], { id: m.id, reference: m.reference, description: `${rule[2]} ${m.party}`, amount: Number(m.amount), currency: m.currency, aed: Number(m.aed_amount), href: `/projects/${pid}/money` });
    }

    const measure = (key: MeasureKey): Measure => {
      const rows = sources.filter((s) => s.measure === key);
      const included = rows.filter((s) => s.projectAmount !== null);
      const revenue = included.filter((s) => s.sign === 1).reduce((t, s) => t + cents(Number(s.projectAmount)), 0);
      const cost = included.filter((s) => s.sign === -1).reduce((t, s) => t + cents(Number(s.projectAmount)), 0);
      const aedRows = rows.filter((s) => s.aedAmount !== null);
      const aedComplete = aedRows.length === rows.length;
      const aed = aedRows.reduce((t, s) => t + s.sign * cents(Number(s.aedAmount)), 0);
      return {
        key, amount: ((revenue - cost) / 100).toFixed(2), aedAmount: aedComplete ? (aed / 100).toFixed(2) : null,
        revenue: (revenue / 100).toFixed(2), cost: (cost / 100).toFixed(2),
        marginPercent: key !== "cash" && revenue > 0 ? (((revenue - cost) / revenue) * 100).toFixed(1) : null,
        formula: FORMULAS[key], notIncluded: rows.length - included.length,
      };
    };
    const measures = { expected: measure("expected"), shipped: measure("shipped"), actual: measure("actual"), cash: measure("cash") };
    const skipped = sources.filter((s) => s.projectAmount === null);
    if (skipped.length) warnings.push(`${skipped.length} document(s) in another currency could not be converted to ${X} and are not included.`);
    if (rateSource === "USD_PEG") warnings.push("No bank rate is recorded on this project yet, so AED figures use the USD peg 3.6725.");

    return {
      project: { id: project.id, reference: project.reference, customerName: project.customer_name, lifecycleState: project.lifecycle_state, currency: X },
      rate: { aedPerUnit: rate === null ? null : String(Math.round(rate * 1e6) / 1e6), source: rateSource },
      measures, sources, warnings, formulaVersion: PROFIT_FORMULA_VERSION,
    };
  }
}

function fmtPrice(value: string) {
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function fmtQty(value: string) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 });
}
