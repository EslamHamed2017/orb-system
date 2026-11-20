import { createHash } from "node:crypto";
import type { SqlClient, SqlTransaction } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { uuidV7Time } from "../shipments/execution/shipment-kinds.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { putDocument, recordDocument, type UploadedDocument } from "../evidence/document-storage.ts";

/**
 * Project money on PostgreSQL.
 *
 * Money movements (always with the bank slip and a manual FX rate to AED):
 *   money in  — customer receipt, supplier refund  → counts at once (CONFIRMED)
 *   money out — supplier payment, customer refund  → CONFIRMED as soon as it is saved (no approval step)
 * Allocation: a confirmed receipt is matched to the customer's issued invoices, a confirmed supplier payment to that
 *   supplier's approved invoices, in the same currency and project; one movement may be split over several invoices.
 *   Whatever is not allocated is an advance. Allocations and movements are reversed with a reason, never deleted.
 * Expenses: recorded with the bill → APPROVED at once (counts as project cost; no approval step);
 *   pending/approved expenses can be cancelled with a reason.
 */

export class MoneyStoreError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID";
  constructor(code: MoneyStoreError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type MovementKind = "CUSTOMER_RECEIPT" | "CUSTOMER_REFUND" | "SUPPLIER_PAYMENT" | "SUPPLIER_REFUND";
export const MOVEMENT_KINDS: Record<MovementKind, { party: "CUSTOMER" | "SUPPLIER"; direction: "IN" | "OUT"; needsApproval: boolean; allocatesTo: "CINV" | "SUPPLIER_INVOICE" | null }> = {
  CUSTOMER_RECEIPT: { party: "CUSTOMER", direction: "IN", needsApproval: false, allocatesTo: "CINV" },
  CUSTOMER_REFUND: { party: "CUSTOMER", direction: "OUT", needsApproval: false, allocatesTo: null },
  SUPPLIER_PAYMENT: { party: "SUPPLIER", direction: "OUT", needsApproval: false, allocatesTo: "SUPPLIER_INVOICE" },
  SUPPLIER_REFUND: { party: "SUPPLIER", direction: "IN", needsApproval: false, allocatesTo: null },
};

export interface DocumentRef { readonly id: string; readonly filename: string; readonly mediaType: string; readonly byteLength: number }
export interface Decision { readonly decision: string; readonly comment: string | null; readonly approverName: string | null }

export interface AllocationSummary {
  readonly id: string; readonly targetType: "CINV" | "SUPPLIER_INVOICE"; readonly targetId: string; readonly invoiceReference: string;
  readonly amount: string; readonly state: "ACTIVE" | "REVERSED"; readonly allocatedAt: string; readonly allocatedByName: string; readonly reversalReason: string | null;
}

export interface MovementSummary {
  readonly id: string; readonly projectId: string; readonly kind: MovementKind; readonly direction: "IN" | "OUT";
  readonly counterparty: { readonly type: "CUSTOMER" | "SUPPLIER"; readonly id: string; readonly name: string };
  readonly amount: string; readonly currency: string; readonly fxRate: string; readonly aedAmount: string;
  readonly occurredOn: string; readonly reference: string; readonly notes: string | null; readonly state: string;
  readonly allocated: string; readonly unallocated: string; readonly allocations: readonly AllocationSummary[];
  readonly document: DocumentRef | null; readonly recordedByName: string; readonly recordedAt: string;
  readonly pendingApprovalId: string | null; readonly requesterId: string | null; readonly lastDecision: Decision | null;
  readonly reversalReason: string | null; readonly version: number;
}

export interface ExpenseSummary {
  readonly id: string; readonly projectId: string; readonly category: { readonly code: string; readonly name: string; readonly nameAr: string };
  readonly payee: { readonly supplierId: string | null; readonly name: string }; readonly description: string | null;
  readonly shipment: { readonly type: "SUPPLIER" | "SALES"; readonly id: string; readonly reference: string } | null;
  readonly amount: string; readonly currency: string; readonly fxRate: string; readonly aedAmount: string; readonly occurredOn: string;
  readonly state: string; readonly document: DocumentRef | null; readonly recordedByName: string; readonly recordedAt: string;
  readonly pendingApprovalId: string | null; readonly requesterId: string | null; readonly lastDecision: Decision | null;
  readonly cancellationReason: string | null; readonly version: number;
}

export interface OpenInvoice {
  readonly type: "CINV" | "SUPPLIER_INVOICE"; readonly id: string; readonly reference: string; readonly counterpartyId: string;
  readonly counterpartyName: string; readonly invoiceDate: string; readonly currency: string; readonly amount: string; readonly allocated: string; readonly outstanding: string;
}

export interface ProjectMoney {
  readonly project: { readonly id: string; readonly reference: string; readonly lifecycleState: string; readonly currency: string };
  readonly customer: { readonly id: string; readonly name: string };
  readonly suppliers: readonly { readonly id: string; readonly name: string }[];
  readonly categories: readonly { readonly code: string; readonly name: string; readonly nameAr: string }[];
  readonly shipments: readonly { readonly type: "SUPPLIER" | "SALES"; readonly id: string; readonly reference: string }[];
  readonly movements: readonly MovementSummary[];
  readonly expenses: readonly ExpenseSummary[];
  readonly invoices: readonly OpenInvoice[];
  readonly totals: readonly CurrencyTotals[];
}

export interface CurrencyTotals {
  readonly currency: string;
  readonly receivedFromCustomer: string; readonly refundedToCustomer: string; readonly paidToSuppliers: string; readonly refundedBySuppliers: string;
  readonly customerInvoiced: string; readonly customerOutstanding: string; readonly customerAdvance: string;
  readonly supplierInvoiced: string; readonly supplierOutstanding: string; readonly supplierAdvance: string;
  readonly expensesApproved: string; readonly expensesPending: string; readonly paymentsPendingApproval: string;
}

export interface MoneyApprovalItem {
  readonly id: string; readonly actionCode: "MONEY_MOVEMENT" | "DIRECT_EXPENSE"; readonly subjectType: "MONEY_MOVEMENT" | "EXPENSE";
  readonly subjectId: string; readonly subjectReference: string; readonly projectId: string; readonly projectReference: string;
  readonly kind: string; readonly counterpartyName: string; readonly amount: string; readonly currency: string; readonly aedAmount: string;
  readonly quantity: string; readonly requesterId: string; readonly requesterName: string; readonly requestedAt: string | null;
}

const money = (value: unknown) => Number(value ?? 0).toFixed(2);
const day = (value: unknown) => (value ? new Date(value as string).toISOString().slice(0, 10) : "");
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : "");
const str = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));
/** Sums with cent precision without floating-point drift. */
const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const fromCents = (value: number) => (value / 100).toFixed(2);

async function uuid(tx: SqlTransaction): Promise<string> {
  return (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT orb_uuidv7()::text id`))[0].id;
}

function documentOf(row: Record<string, unknown>): DocumentRef | null {
  return row.evidence_id ? { id: String(row.evidence_id), filename: String(row.original_filename), mediaType: String(row.media_type), byteLength: Number(row.byte_length) } : null;
}

export class PrismaMoneyStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  private async audit(tx: SqlTransaction, input: { tenantId: string; projectId: string; subjectType: "MOVEMENT" | "ALLOCATION" | "EXPENSE"; subjectId: string; actorId: string; action: string; details: Record<string, unknown> }) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "MoneyAuditEvent" ("tenant_id","project_id","subject_type","subject_id","actor_id","action","details") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      input.tenantId, input.projectId, input.subjectType, input.subjectId, input.actorId, input.action, JSON.stringify(input.details));
  }

  private async project(tx: SqlTransaction, tenantId: string, projectId: string, lock: boolean) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT p."id", p."reference", p."lifecycle_state"::text lifecycle_state, p."management_currency" currency, p."customer_master_id", c."legal_name" customer_name
         FROM "Project" p JOIN "Customer" c ON c."id" = p."customer_master_id"
        WHERE p."id" = $1 AND p."tenant_id" = $2 ${lock ? `FOR UPDATE OF p` : ""}`, projectId, tenantId))[0];
    if (!row) throw new MoneyStoreError("NOT_FOUND", "Project not found");
    return row;
  }

  private async projectSuppliers(tx: SqlTransaction, tenantId: string, projectId: string) {
    return tx.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT DISTINCT s."id"::text id, s."registered_name" name FROM "Contract" k JOIN "Supplier" s ON s."id" = k."counterparty_supplier_id" AND s."tenant_id" = k."tenant_id"
        WHERE k."tenant_id" = $1 AND k."project_id" = $2 AND k."kind" = 'PURCHASE' ORDER BY 2`, tenantId, projectId);
  }

  // ---------------- reads ----------------

  async projectMoney(tenantId: string, projectId: string): Promise<ProjectMoney> {
    const p = await this.project(this.client, tenantId, projectId, false);
    const [suppliers, categories, shipments, movementIds, expenseIds, invoices] = await Promise.all([
      this.projectSuppliers(this.client, tenantId, projectId),
      this.client.$queryRawUnsafe<Array<{ code: string; name: string; name_ar: string }>>(`SELECT "code", "name_en" name, "name_ar" FROM "ExpenseCategory" WHERE "active" AND "code" NOT LIKE 'R1-%' ORDER BY "name_en"`),
      this.client.$queryRawUnsafe<Array<{ type: "SUPPLIER" | "SALES"; id: string; reference: string }>>(
        `SELECT 'SUPPLIER' type, "id"::text id, "reference" FROM "SupplierShipment" WHERE "project_id" = $1 AND "tenant_id" = $2
         UNION ALL SELECT 'SALES', "id"::text, "reference" FROM "SalesShipment" WHERE "project_id" = $1 AND "tenant_id" = $2 ORDER BY 3`, projectId, tenantId),
      this.client.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id"::text id FROM "MoneyMovement" WHERE "tenant_id" = $1 AND "project_id" = $2 ORDER BY "occurred_on" DESC, "id" DESC`, tenantId, projectId),
      this.client.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id"::text id FROM "DirectExpense" WHERE "tenant_id" = $1 AND "project_id" = $2 ORDER BY "occurred_on" DESC, "id" DESC`, tenantId, projectId),
      this.openInvoices(this.client, tenantId, projectId),
    ]);
    const movements = await Promise.all(movementIds.map((row) => this.movement(this.client, tenantId, row.id)));
    const expenses = await Promise.all(expenseIds.map((row) => this.expense(this.client, tenantId, row.id)));
    return {
      project: { id: p.id, reference: p.reference, lifecycleState: p.lifecycle_state, currency: String(p.currency).trim() },
      customer: { id: p.customer_master_id, name: p.customer_name },
      suppliers, categories: categories.map((c) => ({ code: c.code, name: c.name, nameAr: c.name_ar })), shipments, movements, expenses, invoices,
      totals: totals(movements, expenses, invoices),
    };
  }

  /** Issued customer invoices and approved supplier invoices of the project with what is still unpaid. */
  async openInvoices(tx: SqlTransaction, tenantId: string, projectId: string): Promise<OpenInvoice[]> {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT 'CINV' type, i."id", i."reference", i."customer_master_id" counterparty_id, c."legal_name" counterparty_name, i."invoice_date", i."currency",
              ((SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id") + i."vat_amount")::text amount,
              COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'CINV' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text allocated
         FROM "SalesInvoice" i JOIN "Customer" c ON c."id" = i."customer_master_id"
        WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text = 'ISSUED'
       UNION ALL
       SELECT 'SUPPLIER_INVOICE', i."id", i."reference", i."supplier_master_id", s."registered_name", i."invoice_date", i."currency", i."amount"::text,
              COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'SUPPLIER_INVOICE' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text
         FROM "SupplierInvoice" i JOIN "Supplier" s ON s."id" = i."supplier_master_id"
        WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text = 'CONFIRMED'
        ORDER BY 6, 3`, tenantId, projectId);
    return rows.map((r) => ({
      type: r.type as OpenInvoice["type"], id: String(r.id), reference: String(r.reference), counterpartyId: String(r.counterparty_id), counterpartyName: String(r.counterparty_name),
      invoiceDate: day(r.invoice_date), currency: String(r.currency).trim(), amount: money(r.amount), allocated: money(r.allocated), outstanding: fromCents(cents(r.amount) - cents(r.allocated)),
    }));
  }

  async getMovement(tenantId: string, movementId: string) { return this.movement(this.client, tenantId, movementId); }
  async getExpense(tenantId: string, expenseId: string) { return this.expense(this.client, tenantId, expenseId); }

  private async movement(tx: SqlTransaction, tenantId: string, movementId: string): Promise<MovementSummary> {
    const r = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT m.*, m."state"::text state_text, m."kind"::text kind_text, m."amount"::text amount_text, m."aed_amount"::text aed_text, m."fx_rate"::text fx_text,
              COALESCE(c."legal_name", s."registered_name") counterparty_name, u."name_en" recorded_by_name,
              e."original_filename", e."media_type", e."byte_length"
         FROM "MoneyMovement" m LEFT JOIN "Customer" c ON c."id" = m."customer_master_id" LEFT JOIN "Supplier" s ON s."id" = m."supplier_master_id"
         LEFT JOIN "User" u ON u."id" = m."recorded_by" LEFT JOIN "EvidenceObject" e ON e."id" = m."evidence_id"
        WHERE m."tenant_id" = $1 AND m."id" = $2`, tenantId, movementId))[0];
    if (!r) throw new MoneyStoreError("NOT_FOUND", "Payment not found");
    const allocations = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT a."id", a."target_type"::text target_type, a."target_id", a."amount"::text amount, a."state"::text state, a."allocated_at", a."reversal_reason", u."name_en" by_name,
              COALESCE(si."reference", pi."reference") invoice_reference
         FROM "SettlementAllocation" a JOIN "User" u ON u."id" = a."allocated_by"
         LEFT JOIN "SalesInvoice" si ON a."target_type" = 'CINV' AND si."id" = a."target_id"
         LEFT JOIN "SupplierInvoice" pi ON a."target_type" = 'SUPPLIER_INVOICE' AND pi."id" = a."target_id"
        WHERE a."movement_id" = $1 AND a."tenant_id" = $2 ORDER BY a."id"`, movementId, tenantId)).map((a) => ({
      id: String(a.id), targetType: a.target_type as AllocationSummary["targetType"], targetId: String(a.target_id), invoiceReference: String(a.invoice_reference ?? ""),
      amount: money(a.amount), state: a.state as AllocationSummary["state"], allocatedAt: iso(a.allocated_at), allocatedByName: String(a.by_name), reversalReason: str(a.reversal_reason),
    }));
    const allocatedCents = allocations.filter((a) => a.state === "ACTIVE").reduce((sum, a) => sum + cents(a.amount), 0);
    const approval = await this.approvalState(tx, "MONEY_MOVEMENT", movementId);
    const kind = r.kind_text as MovementKind;
    return {
      id: String(r.id), projectId: String(r.project_id), kind, direction: r.direction as "IN" | "OUT",
      counterparty: { type: MOVEMENT_KINDS[kind]?.party ?? "CUSTOMER", id: String(r.customer_master_id ?? r.supplier_master_id), name: String(r.counterparty_name ?? "") },
      amount: money(r.amount_text), currency: String(r.currency).trim(), fxRate: String(Number(r.fx_text)), aedAmount: money(r.aed_text),
      occurredOn: day(r.occurred_on), reference: String(r.reference), notes: str(r.notes), state: String(r.state_text),
      allocated: fromCents(allocatedCents), unallocated: fromCents(r.state_text === "REVERSED" || r.state_text === "REJECTED" ? 0 : cents(r.amount_text) - allocatedCents),
      allocations, document: documentOf(r), recordedByName: String(r.recorded_by_name ?? ""), recordedAt: iso(r.recorded_at),
      ...approval, reversalReason: str(r.reversal_reason), version: Number(r.version),
    };
  }

  private async expense(tx: SqlTransaction, tenantId: string, expenseId: string): Promise<ExpenseSummary> {
    const r = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT x.*, x."state"::text state_text, x."amount"::text amount_text, x."aed_amount"::text aed_text, x."fx_rate"::text fx_text,
              k."name_en" category_name, k."name_ar" category_name_ar, s."registered_name" supplier_name, u."name_en" recorded_by_name,
              ss."reference" supplier_shipment_reference, sa."reference" sales_shipment_reference,
              e."original_filename", e."media_type", e."byte_length"
         FROM "DirectExpense" x JOIN "ExpenseCategory" k ON k."code" = x."category_code"
         LEFT JOIN "Supplier" s ON s."id" = x."supplier_master_id" LEFT JOIN "User" u ON u."id" = x."recorded_by"
         LEFT JOIN "SupplierShipment" ss ON ss."id" = x."supplier_shipment_id" LEFT JOIN "SalesShipment" sa ON sa."id" = x."sales_shipment_id"
         LEFT JOIN "EvidenceObject" e ON e."id" = x."evidence_id"
        WHERE x."tenant_id" = $1 AND x."id" = $2`, tenantId, expenseId))[0];
    if (!r) throw new MoneyStoreError("NOT_FOUND", "Expense not found");
    const approval = await this.approvalState(tx, "DIRECT_EXPENSE", expenseId);
    const shipment = r.supplier_shipment_id ? { type: "SUPPLIER" as const, id: String(r.supplier_shipment_id), reference: String(r.supplier_shipment_reference) }
      : r.sales_shipment_id ? { type: "SALES" as const, id: String(r.sales_shipment_id), reference: String(r.sales_shipment_reference) } : null;
    return {
      id: String(r.id), projectId: String(r.project_id), category: { code: String(r.category_code), name: String(r.category_name), nameAr: String(r.category_name_ar) },
      payee: { supplierId: str(r.supplier_master_id), name: String(r.supplier_name ?? r.payee_name ?? "") }, description: str(r.description), shipment,
      amount: money(r.amount_text), currency: String(r.currency).trim(), fxRate: String(Number(r.fx_text)), aedAmount: money(r.aed_text), occurredOn: day(r.occurred_on),
      state: String(r.state_text), document: documentOf(r), recordedByName: String(r.recorded_by_name ?? ""), recordedAt: iso(r.recorded_at),
      ...approval, cancellationReason: str(r.cancellation_reason), version: Number(r.version),
    };
  }

  private async approvalState(tx: SqlTransaction, actionCode: "MONEY_MOVEMENT" | "DIRECT_EXPENSE", subjectId: string) {
    const approvals = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."decision"::text decision, ap."requester_id", ap."comment", u."name_en" approver_name FROM "Approval" ap LEFT JOIN "User" u ON u."id" = ap."approver_id"
        WHERE ap."action_code"::text = $1 AND ap."subject_id" = $2 ORDER BY ap."id" DESC`, actionCode, subjectId);
    const pending = approvals.find((a) => a.decision === "PENDING");
    const decided = approvals.find((a) => a.decision === "APPROVED" || a.decision === "REJECTED");
    return {
      pendingApprovalId: pending ? String(pending.id) : null,
      requesterId: pending ? String(pending.requester_id) : null,
      lastDecision: decided ? { decision: String(decided.decision), comment: str(decided.comment), approverName: str(decided.approver_name) } : null,
    };
  }

  async listPendingApprovals(tenantId: string): Promise<MoneyApprovalItem[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."action_code"::text action_code, ap."subject_id", ap."requester_id", u."name_en" requester_name, p."id" project_id, p."reference" project_reference,
              m."kind"::text kind, m."reference" subject_reference, COALESCE(c."legal_name", s."registered_name") counterparty_name, m."amount"::text amount, m."currency", m."aed_amount"::text aed
         FROM "Approval" ap JOIN "MoneyMovement" m ON m."id" = ap."subject_id" AND m."tenant_id" = $1 JOIN "Project" p ON p."id" = m."project_id"
         LEFT JOIN "Customer" c ON c."id" = m."customer_master_id" LEFT JOIN "Supplier" s ON s."id" = m."supplier_master_id" JOIN "User" u ON u."id" = ap."requester_id"
        WHERE ap."action_code"::text = 'MONEY_MOVEMENT' AND ap."decision" = 'PENDING'
       UNION ALL
       SELECT ap."id", ap."action_code"::text, ap."subject_id", ap."requester_id", u."name_en", p."id", p."reference",
              x."category_code", k."name_en", COALESCE(s."registered_name", x."payee_name"), x."amount"::text, x."currency", x."aed_amount"::text
         FROM "Approval" ap JOIN "DirectExpense" x ON x."id" = ap."subject_id" AND x."tenant_id" = $1 JOIN "Project" p ON p."id" = x."project_id"
         JOIN "ExpenseCategory" k ON k."code" = x."category_code" LEFT JOIN "Supplier" s ON s."id" = x."supplier_master_id" JOIN "User" u ON u."id" = ap."requester_id"
        WHERE ap."action_code"::text = 'DIRECT_EXPENSE' AND ap."decision" = 'PENDING'
        ORDER BY 1`, tenantId);
    return rows.map((r) => ({
      id: String(r.id), actionCode: r.action_code as MoneyApprovalItem["actionCode"], subjectType: r.action_code === "MONEY_MOVEMENT" ? "MONEY_MOVEMENT" : "EXPENSE",
      subjectId: String(r.subject_id), subjectReference: String(r.subject_reference), projectId: String(r.project_id), projectReference: String(r.project_reference),
      kind: String(r.kind), counterpartyName: String(r.counterparty_name ?? ""), amount: money(r.amount), currency: String(r.currency).trim(), aedAmount: money(r.aed), quantity: "0",
      requesterId: String(r.requester_id), requesterName: String(r.requester_name), requestedAt: uuidV7Time(String(r.id)),
    }));
  }

  async approvalSubject(tenantId: string, approvalId: string): Promise<{ type: "MOVEMENT" | "EXPENSE"; id: string } | null> {
    const row = (await this.client.$queryRawUnsafe<Array<{ action_code: string; subject_id: string }>>(
      `SELECT ap."action_code"::text action_code, ap."subject_id"::text subject_id FROM "Approval" ap
         LEFT JOIN "MoneyMovement" m ON ap."action_code"::text = 'MONEY_MOVEMENT' AND m."id" = ap."subject_id" AND m."tenant_id" = $2
         LEFT JOIN "DirectExpense" x ON ap."action_code"::text = 'DIRECT_EXPENSE' AND x."id" = ap."subject_id" AND x."tenant_id" = $2
        WHERE ap."id" = $1 AND (m."id" IS NOT NULL OR x."id" IS NOT NULL)`, approvalId, tenantId))[0];
    return row ? { type: row.action_code === "MONEY_MOVEMENT" ? "MOVEMENT" : "EXPENSE", id: row.subject_id } : null;
  }

  // ---------------- money movements ----------------

  async recordMovement(input: {
    tenantId: string; actorId: string; projectId: string; kind: MovementKind; counterpartyId: string; amount: string; currency: string;
    fxRate: string; occurredOn: string; reference: string; notes: string | null; document: UploadedDocument;
  }): Promise<MovementSummary> {
    const rule = MOVEMENT_KINDS[input.kind];
    await this.checkMovementParty(this.client, input);
    const evidenceId = await uuid(this.client);
    const stored = await putDocument(input.document, evidenceId);
    return this.client.$transaction(async (tx) => {
      await this.checkMovementParty(tx, input);
      const movementId = await uuid(tx);
      await recordDocument(tx, { evidenceId, projectId: input.projectId, actorId: input.actorId, document: input.document, stored, subjectType: "MONEY_MOVEMENT", subjectId: movementId, purpose: "BANK_SLIP", parentType: "PROJECT", parentId: input.projectId });
      await tx.$executeRawUnsafe(
        `INSERT INTO "MoneyMovement" ("id","project_id","tenant_id","customer_master_id","supplier_master_id","kind","direction","amount","currency","occurred_on","reference","evidence_id","state",
                                      "aed_amount","fx_rate","fx_date","fx_source","notes","recorded_by","recorded_at")
         VALUES ($1,$2,$3,$4,$5,$6::"MoneyMovementKind",$7,$8::numeric,$9,$10::date,$11,$12,$13::"MoneyMovementState",ROUND($8::numeric * $14::numeric, 2),$14::numeric,$10::date,'MANUAL',$15,$16,NOW())`,
        movementId, input.projectId, input.tenantId, rule.party === "CUSTOMER" ? input.counterpartyId : null, rule.party === "SUPPLIER" ? input.counterpartyId : null,
        input.kind, rule.direction, input.amount, input.currency, input.occurredOn, input.reference, evidenceId, rule.needsApproval ? "PENDING_APPROVAL" : "CONFIRMED", input.fxRate, input.notes, input.actorId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "MOVEMENT", subjectId: movementId, actorId: input.actorId, action: "RECORDED", details: { kind: input.kind, amount: input.amount, currency: input.currency, fxRate: input.fxRate, evidenceId } });
      if (rule.needsApproval) {
        const approvalId = await this.requestApproval(tx, "MONEY_MOVEMENT", "MONEY_MOVEMENT", movementId, 1, { ...input, document: undefined }, input.actorId);
        await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "MOVEMENT", subjectId: movementId, actorId: input.actorId, action: "SUBMITTED", details: { approvalId } });
      }
      return this.movement(tx, input.tenantId, movementId);
    }).catch((error: { message?: string }) => {
      if (String(error?.message ?? "").includes("MoneyMovement_project_id_reference_key")) throw new MoneyStoreError("CONFLICT", "This bank reference is already recorded on this project.");
      throw error;
    });
  }

  private async checkMovementParty(tx: SqlTransaction, input: { tenantId: string; projectId: string; kind: MovementKind; counterpartyId: string }) {
    const p = await this.project(tx, input.tenantId, input.projectId, false);
    if (p.lifecycle_state === "CANCELLED") throw new MoneyStoreError("CONFLICT", "This project is cancelled.");
    if (MOVEMENT_KINDS[input.kind].party === "CUSTOMER") {
      if (p.customer_master_id !== input.counterpartyId) throw new MoneyStoreError("INVALID", "The customer must be this project's customer.");
    } else if (!(await this.projectSuppliers(tx, input.tenantId, input.projectId)).some((s) => s.id === input.counterpartyId)) {
      throw new MoneyStoreError("INVALID", "The supplier must have a purchase contract on this project.");
    }
  }

  /** With `saved`, the record counts at once (no approval step); the Approval row only records who saved it. */
  private async requestApproval(tx: SqlTransaction, actionCode: "MONEY_MOVEMENT" | "DIRECT_EXPENSE", subjectType: string, subjectId: string, version: number, facts: unknown, requesterId: string, saved = false) {
    return (await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Approval" ("action_code","subject_type","subject_id","subject_version","subject_hash","requester_id","decision","decided_at","comment")
       VALUES ($1::"ApprovalActionCode",$2,$3,$4,$5,$6,$7::"ApprovalDecision",CASE WHEN $7 = 'APPROVED' THEN NOW() END,CASE WHEN $7 = 'APPROVED' THEN 'Saved' END) RETURNING "id"::text id`,
      actionCode, subjectType, subjectId, version, createHash("sha256").update(JSON.stringify(facts)).digest("hex"), requesterId, saved ? "APPROVED" : "PENDING"))[0].id;
  }

  private async lockMovement(tx: SqlTransaction, tenantId: string, movementId: string) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "project_id", "kind"::text kind, "state"::text state, "amount"::text amount, "currency", "customer_master_id", "supplier_master_id", "version"
         FROM "MoneyMovement" WHERE "tenant_id" = $1 AND "id" = $2 FOR UPDATE`, tenantId, movementId))[0];
    if (!row) throw new MoneyStoreError("NOT_FOUND", "Payment not found");
    return row;
  }

  private async decide(tx: SqlTransaction, approvalId: string, approverId: string, decision: "APPROVED" | "REJECTED", comment: string | null) {
    const approval = (await tx.$queryRawUnsafe<Array<{ decision: string; requester_id: string }>>(`SELECT "decision"::text decision, "requester_id" FROM "Approval" WHERE "id" = $1 FOR UPDATE`, approvalId))[0];
    if (!approval || approval.decision !== "PENDING") throw new MoneyStoreError("CONFLICT", "This approval was already decided or withdrawn.");
    if (approval.requester_id === approverId) throw new MoneyStoreError("INVALID", "You cannot approve your own request.");
    await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = $2::"ApprovalDecision", "approver_id" = $3, "decided_at" = NOW(), "comment" = $4 WHERE "id" = $1`, approvalId, decision, approverId, comment);
  }

  async decideMovement(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null; movementId: string }): Promise<MovementSummary> {
    return this.client.$transaction(async (tx) => {
      const m = await this.lockMovement(tx, input.tenantId, input.movementId);
      if (m.state !== "PENDING_APPROVAL") throw new MoneyStoreError("CONFLICT", "This payment is no longer waiting for approval.");
      await this.decide(tx, input.approvalId, input.approverId, input.decision, input.comment);
      await tx.$executeRawUnsafe(`UPDATE "MoneyMovement" SET "state" = $2::"MoneyMovementState", "version" = "version" + 1 WHERE "id" = $1`, input.movementId, input.decision === "APPROVED" ? "CONFIRMED" : "REJECTED");
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(m.project_id), subjectType: "MOVEMENT", subjectId: input.movementId, actorId: input.approverId, action: input.decision, details: { approvalId: input.approvalId, comment: input.comment } });
      return this.movement(tx, input.tenantId, input.movementId);
    });
  }

  async allocate(input: { tenantId: string; actorId: string; movementId: string; targetType: "CINV" | "SUPPLIER_INVOICE"; targetId: string; amount: string; currency: string }): Promise<MovementSummary> {
    return this.client.$transaction(async (tx) => {
      const m = await this.lockMovement(tx, input.tenantId, input.movementId);
      const rule = MOVEMENT_KINDS[m.kind as MovementKind];
      if (!rule?.allocatesTo) throw new MoneyStoreError("INVALID", "Refunds are not matched to invoices.");
      if (rule.allocatesTo !== input.targetType) throw new MoneyStoreError("INVALID", rule.allocatesTo === "CINV" ? "A customer receipt can only be matched to customer invoices." : "A supplier payment can only be matched to supplier invoices.");
      if (!["CONFIRMED", "PARTIALLY_ALLOCATED"].includes(String(m.state))) throw new MoneyStoreError("CONFLICT", m.state === "PENDING_APPROVAL" ? "This payment is still waiting for owner approval." : "This payment has nothing left to allocate.");
      const invoice = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        input.targetType === "CINV"
          ? `SELECT i."project_id", i."customer_master_id" party_id, i."currency", i."state"::text state, ((SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id") + i."vat_amount")::text amount
               FROM "SalesInvoice" i WHERE i."tenant_id" = $1 AND i."id" = $2 FOR UPDATE OF i`
          : `SELECT i."project_id", i."supplier_master_id" party_id, i."currency", i."state"::text state, i."amount"::text amount
               FROM "SupplierInvoice" i WHERE i."tenant_id" = $1 AND i."id" = $2 FOR UPDATE OF i`, input.tenantId, input.targetId))[0];
      if (!invoice) throw new MoneyStoreError("NOT_FOUND", "Invoice not found");
      if (invoice.project_id !== m.project_id) throw new MoneyStoreError("INVALID", "The invoice belongs to another project.");
      if (invoice.party_id !== (m.customer_master_id ?? m.supplier_master_id)) throw new MoneyStoreError("INVALID", "The invoice is for a different customer or supplier.");
      if (String(invoice.currency).trim() !== String(m.currency).trim() || input.currency !== String(m.currency).trim()) throw new MoneyStoreError("INVALID", "The payment and the invoice must be in the same currency.");
      if (invoice.state !== (input.targetType === "CINV" ? "ISSUED" : "CONFIRMED")) throw new MoneyStoreError("CONFLICT", input.targetType === "CINV" ? "Only issued invoices can be paid." : "Only approved supplier invoices can be paid.");
      const sums = (await tx.$queryRawUnsafe<Array<{ movement: string; invoice: string }>>(
        `SELECT COALESCE((SELECT SUM("amount") FROM "SettlementAllocation" WHERE "movement_id" = $1 AND "state" = 'ACTIVE'), 0)::text movement,
                COALESCE((SELECT SUM("amount") FROM "SettlementAllocation" WHERE "target_type" = $2::"AllocationTargetType" AND "target_id" = $3 AND "state" = 'ACTIVE'), 0)::text invoice`,
        input.movementId, input.targetType, input.targetId))[0];
      const left = cents(m.amount) - cents(sums.movement), outstanding = cents(invoice.amount) - cents(sums.invoice), amount = cents(input.amount);
      if (amount > left) throw new MoneyStoreError("INVALID", `Only ${fromCents(left)} ${String(m.currency).trim()} of this payment is still unallocated.`);
      if (amount > outstanding) throw new MoneyStoreError("INVALID", `The invoice only has ${fromCents(outstanding)} ${String(m.currency).trim()} outstanding.`);
      const allocationId = await uuid(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SettlementAllocation" ("id","movement_id","target_type","target_id","amount","currency","state","allocated_by","allocated_at","tenant_id")
         VALUES ($1,$2,$3::"AllocationTargetType",$4,$5::numeric,$6,'ACTIVE',$7,NOW(),$8)`,
        allocationId, input.movementId, input.targetType, input.targetId, input.amount, String(m.currency).trim(), input.actorId, input.tenantId);
      await this.refreshMovementState(tx, input.movementId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(m.project_id), subjectType: "ALLOCATION", subjectId: allocationId, actorId: input.actorId, action: "ALLOCATED", details: { movementId: input.movementId, targetType: input.targetType, targetId: input.targetId, amount: input.amount } });
      return this.movement(tx, input.tenantId, input.movementId);
    });
  }

  private async refreshMovementState(tx: SqlTransaction, movementId: string) {
    await tx.$executeRawUnsafe(
      `UPDATE "MoneyMovement" m SET "version" = m."version" + 1, "state" = (CASE
          WHEN a.total = 0 THEN 'CONFIRMED' WHEN a.total >= m."amount" THEN 'FULLY_ALLOCATED' ELSE 'PARTIALLY_ALLOCATED' END)::"MoneyMovementState"
         FROM (SELECT COALESCE(SUM("amount"), 0) total FROM "SettlementAllocation" WHERE "movement_id" = $1 AND "state" = 'ACTIVE') a
        WHERE m."id" = $1 AND m."state"::text IN ('CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED')`, movementId);
  }

  async reverseAllocation(input: { tenantId: string; actorId: string; allocationId: string; reason: string }): Promise<MovementSummary> {
    return this.client.$transaction(async (tx) => {
      const a = (await tx.$queryRawUnsafe<Array<{ movement_id: string; state: string }>>(
        `SELECT "movement_id"::text movement_id, "state"::text state FROM "SettlementAllocation" WHERE "tenant_id" = $1 AND "id" = $2`, input.tenantId, input.allocationId))[0];
      if (!a) throw new MoneyStoreError("NOT_FOUND", "Allocation not found");
      const m = await this.lockMovement(tx, input.tenantId, a.movement_id);
      const changed = await tx.$executeRawUnsafe(
        `UPDATE "SettlementAllocation" SET "state" = 'REVERSED', "reversal_reason" = $2, "reversed_by" = $3, "reversed_at" = NOW(), "version" = "version" + 1 WHERE "id" = $1 AND "state" = 'ACTIVE'`,
        input.allocationId, input.reason, input.actorId);
      if (!changed) throw new MoneyStoreError("CONFLICT", "This allocation is already reversed.");
      await this.refreshMovementState(tx, a.movement_id);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(m.project_id), subjectType: "ALLOCATION", subjectId: input.allocationId, actorId: input.actorId, action: "REVERSED", details: { reason: input.reason, movementId: a.movement_id } });
      return this.movement(tx, input.tenantId, a.movement_id);
    });
  }

  /** Reverses a movement entered by mistake: withdraws a pending approval, or reverses its allocations, keeping all history. */
  async reverseMovement(input: { tenantId: string; actorId: string; movementId: string; reason: string }): Promise<MovementSummary> {
    return this.client.$transaction(async (tx) => {
      const m = await this.lockMovement(tx, input.tenantId, input.movementId);
      if (!["PENDING_APPROVAL", "CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"].includes(String(m.state))) throw new MoneyStoreError("CONFLICT", "This payment is already reversed or rejected.");
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = 'EXPIRED', "decided_at" = NOW() WHERE "action_code"::text = 'MONEY_MOVEMENT' AND "subject_id" = $1 AND "decision" = 'PENDING'`, input.movementId);
      const reversed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "SettlementAllocation" SET "state" = 'REVERSED', "reversal_reason" = $2, "reversed_by" = $3, "reversed_at" = NOW(), "version" = "version" + 1
          WHERE "movement_id" = $1 AND "state" = 'ACTIVE' RETURNING "id"::text id`, input.movementId, input.reason, input.actorId);
      for (const row of reversed) await this.audit(tx, { tenantId: input.tenantId, projectId: String(m.project_id), subjectType: "ALLOCATION", subjectId: row.id, actorId: input.actorId, action: "REVERSED", details: { reason: input.reason, movementId: input.movementId } });
      await tx.$executeRawUnsafe(
        `UPDATE "MoneyMovement" SET "state" = 'REVERSED', "reversal_reason" = $2, "reversed_by" = $3, "reversed_at" = NOW(), "version" = "version" + 1 WHERE "id" = $1`,
        input.movementId, input.reason, input.actorId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(m.project_id), subjectType: "MOVEMENT", subjectId: input.movementId, actorId: input.actorId, action: "REVERSED", details: { reason: input.reason, previousState: m.state, allocationsReversed: reversed.length } });
      return this.movement(tx, input.tenantId, input.movementId);
    });
  }

  // ---------------- expenses ----------------

  async createExpense(input: {
    tenantId: string; actorId: string; projectId: string; categoryCode: string; supplierId: string | null; payeeName: string | null; description: string | null;
    shipment: { type: "SUPPLIER" | "SALES"; id: string } | null; amount: string; currency: string; fxRate: string; occurredOn: string; document: UploadedDocument;
  }): Promise<ExpenseSummary> {
    await this.checkExpense(this.client, input);
    const evidenceId = await uuid(this.client);
    const stored = await putDocument(input.document, evidenceId);
    return this.client.$transaction(async (tx) => {
      await this.checkExpense(tx, input);
      const expenseId = await uuid(tx);
      await recordDocument(tx, { evidenceId, projectId: input.projectId, actorId: input.actorId, document: input.document, stored, subjectType: "EXPENSE", subjectId: expenseId, purpose: "EXPENSE_BILL", parentType: "PROJECT", parentId: input.projectId });
      const approvalId = await this.requestApproval(tx, "DIRECT_EXPENSE", "EXPENSE", expenseId, 1, { ...input, document: undefined }, input.actorId, true);
      await tx.$executeRawUnsafe(
        `INSERT INTO "DirectExpense" ("id","project_id","tenant_id","category_code","supplier_master_id","payee_name","description","supplier_shipment_id","sales_shipment_id",
                                      "amount","currency","occurred_on","evidence_id","state","approval_id","aed_amount","fx_rate","recorded_by","recorded_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::numeric,$11,$12::date,$13,'APPROVED',$14,ROUND($10::numeric * $15::numeric, 2),$15::numeric,$16,NOW())`,
        expenseId, input.projectId, input.tenantId, input.categoryCode, input.supplierId, input.supplierId ? null : input.payeeName, input.description,
        input.shipment?.type === "SUPPLIER" ? input.shipment.id : null, input.shipment?.type === "SALES" ? input.shipment.id : null,
        input.amount, input.currency, input.occurredOn, evidenceId, approvalId, input.fxRate, input.actorId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "EXPENSE", subjectId: expenseId, actorId: input.actorId, action: "RECORDED", details: { category: input.categoryCode, amount: input.amount, currency: input.currency, evidenceId } });
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "EXPENSE", subjectId: expenseId, actorId: input.actorId, action: "APPROVED", details: { approvalId, comment: "Saved" } });
      return this.expense(tx, input.tenantId, expenseId);
    });
  }

  private async checkExpense(tx: SqlTransaction, input: { tenantId: string; projectId: string; categoryCode: string; supplierId: string | null; shipment: { type: "SUPPLIER" | "SALES"; id: string } | null }) {
    const p = await this.project(tx, input.tenantId, input.projectId, false);
    if (p.lifecycle_state === "CANCELLED") throw new MoneyStoreError("CONFLICT", "This project is cancelled.");
    const category = (await tx.$queryRawUnsafe<Array<{ code: string }>>(`SELECT "code" FROM "ExpenseCategory" WHERE "code" = $1 AND "active"`, input.categoryCode))[0];
    if (!category) throw new MoneyStoreError("INVALID", "Choose an expense category from the list.");
    if (input.supplierId) {
      const supplier = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Supplier" WHERE "id" = $1 AND "tenant_id" = $2`, input.supplierId, input.tenantId))[0];
      if (!supplier) throw new MoneyStoreError("INVALID", "Supplier not found.");
    }
    if (input.shipment) {
      const table = input.shipment.type === "SUPPLIER" ? "SupplierShipment" : "SalesShipment";
      const shipment = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "${table}" WHERE "id" = $1 AND "project_id" = $2 AND "tenant_id" = $3`, input.shipment.id, input.projectId, input.tenantId))[0];
      if (!shipment) throw new MoneyStoreError("INVALID", "The shipment is not part of this project.");
    }
  }

  private async lockExpense(tx: SqlTransaction, tenantId: string, expenseId: string) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "project_id", "state"::text state, "approval_id" FROM "DirectExpense" WHERE "tenant_id" = $1 AND "id" = $2 FOR UPDATE`, tenantId, expenseId))[0];
    if (!row) throw new MoneyStoreError("NOT_FOUND", "Expense not found");
    return row;
  }

  async decideExpense(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null; expenseId: string }): Promise<ExpenseSummary> {
    return this.client.$transaction(async (tx) => {
      const x = await this.lockExpense(tx, input.tenantId, input.expenseId);
      if (x.state !== "PENDING_APPROVAL" || x.approval_id !== input.approvalId) throw new MoneyStoreError("CONFLICT", "This expense is no longer waiting for approval.");
      await this.decide(tx, input.approvalId, input.approverId, input.decision, input.comment);
      await tx.$executeRawUnsafe(`UPDATE "DirectExpense" SET "state" = $2::"DirectExpenseState", "version" = "version" + 1 WHERE "id" = $1`, input.expenseId, input.decision);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(x.project_id), subjectType: "EXPENSE", subjectId: input.expenseId, actorId: input.approverId, action: input.decision, details: { approvalId: input.approvalId, comment: input.comment } });
      return this.expense(tx, input.tenantId, input.expenseId);
    });
  }

  async cancelExpense(input: { tenantId: string; actorId: string; expenseId: string; reason: string }): Promise<ExpenseSummary> {
    return this.client.$transaction(async (tx) => {
      const x = await this.lockExpense(tx, input.tenantId, input.expenseId);
      if (!["PENDING_APPROVAL", "APPROVED", "DRAFT"].includes(String(x.state))) throw new MoneyStoreError("CONFLICT", "This expense is already closed.");
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = 'EXPIRED', "decided_at" = NOW() WHERE "action_code"::text = 'DIRECT_EXPENSE' AND "subject_id" = $1 AND "decision" = 'PENDING'`, input.expenseId);
      await tx.$executeRawUnsafe(
        `UPDATE "DirectExpense" SET "state" = 'CANCELLED', "cancellation_reason" = $2, "cancelled_by" = $3, "cancelled_at" = NOW(), "version" = "version" + 1 WHERE "id" = $1`,
        input.expenseId, input.reason, input.actorId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(x.project_id), subjectType: "EXPENSE", subjectId: input.expenseId, actorId: input.actorId, action: "CANCELLED", details: { reason: input.reason, previousState: x.state } });
      return this.expense(tx, input.tenantId, input.expenseId);
    });
  }
}

/** Per-currency position of the project: what came in and went out, what is still owed either way, and costs. */
function totals(movements: readonly MovementSummary[], expenses: readonly ExpenseSummary[], invoices: readonly OpenInvoice[]): CurrencyTotals[] {
  const currencies = new Set([...movements.map((m) => m.currency), ...expenses.map((x) => x.currency), ...invoices.map((i) => i.currency)]);
  return [...currencies].sort().map((currency) => {
    const live = movements.filter((m) => m.currency === currency && ["CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"].includes(m.state));
    const sum = (rows: readonly { amount: string }[]) => rows.reduce((total, row) => total + cents(row.amount), 0);
    const of = (kind: MovementKind) => live.filter((m) => m.kind === kind);
    const inv = (type: OpenInvoice["type"]) => invoices.filter((i) => i.currency === currency && i.type === type);
    const unallocated = (kind: MovementKind) => of(kind).reduce((total, m) => total + cents(m.unallocated), 0);
    return {
      currency,
      receivedFromCustomer: fromCents(sum(of("CUSTOMER_RECEIPT"))), refundedToCustomer: fromCents(sum(of("CUSTOMER_REFUND"))),
      paidToSuppliers: fromCents(sum(of("SUPPLIER_PAYMENT"))), refundedBySuppliers: fromCents(sum(of("SUPPLIER_REFUND"))),
      customerInvoiced: fromCents(sum(inv("CINV"))), customerOutstanding: fromCents(inv("CINV").reduce((t, i) => t + cents(i.outstanding), 0)),
      customerAdvance: fromCents(unallocated("CUSTOMER_RECEIPT") - sum(of("CUSTOMER_REFUND"))),
      supplierInvoiced: fromCents(sum(inv("SUPPLIER_INVOICE"))), supplierOutstanding: fromCents(inv("SUPPLIER_INVOICE").reduce((t, i) => t + cents(i.outstanding), 0)),
      supplierAdvance: fromCents(unallocated("SUPPLIER_PAYMENT") - sum(of("SUPPLIER_REFUND"))),
      expensesApproved: fromCents(sum(expenses.filter((x) => x.currency === currency && x.state === "APPROVED"))),
      expensesPending: fromCents(sum(expenses.filter((x) => x.currency === currency && x.state === "PENDING_APPROVAL"))),
      paymentsPendingApproval: fromCents(sum(movements.filter((m) => m.currency === currency && m.state === "PENDING_APPROVAL"))),
    };
  });
}
