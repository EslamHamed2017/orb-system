import { createHash } from "node:crypto";
import type { SqlClient, SqlTransaction } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { uuidV7Time } from "../shipments/execution/shipment-kinds.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { putDocument, recordDocument, type UploadedDocument } from "../evidence/document-storage.ts";

/**
 * Supplier and customer invoices on PostgreSQL, one invoice line per shipment:
 * line = shipment quantity × the contract's unit price, in the contract currency.
 *
 * Supplier invoice: DRAFT (with the scanned document) → submit → owner approves → CONFIRMED,
 *                   or owner rejects → REJECTED; DRAFT/CONFIRMED can be cancelled with a reason.
 * Customer invoice: created from a confirmed customer shipment and ISSUED at once with a
 *                   tenant-wide reference ORB-INV-YYYY-NNNNNN; can be cancelled with a reason.
 */

export class InvoiceStoreError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID";
  constructor(code: InvoiceStoreError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type InvoiceType = "SUPPLIER" | "SALES";
export interface CompanyDocumentProfile {
  readonly legalNameEn: string; readonly legalNameAr: string; readonly addressEn: string; readonly addressAr: string;
  readonly phone: string; readonly email: string; readonly website: string; readonly trn: string; readonly licenceNo: string;
  readonly bankName: string; readonly bankAccountName: string; readonly iban: string; readonly swift: string; readonly bankCurrency: string;
  readonly termsEn: string; readonly termsAr: string; readonly footerEn: string; readonly footerAr: string;
  readonly brandColor: string; readonly documentLanguage: "BILINGUAL" | "EN" | "AR"; readonly vatRegistered: boolean; readonly logoDataUrl: string | null;
}
export type VatTreatment = "STANDARD" | "ZERO_RATED" | "EXEMPT" | "OUT_OF_SCOPE";
export const VAT_TREATMENTS: readonly VatTreatment[] = ["STANDARD", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"];

export interface InvoiceSummary {
  readonly type: InvoiceType;
  /** Payments allocated to the invoice (active allocations) and what is still unpaid. */
  readonly paid: string;
  readonly outstanding: string;
  readonly id: string;
  readonly reference: string;
  readonly invoiceDate: string;
  readonly state: string;
  readonly currency: string;
  readonly amount: string;
  readonly expectedAmount: string;
  /** Customer invoices: VAT treatment, rate and amount (amount = net + VAT). Null for supplier invoices. */
  readonly vat?: { readonly treatment: VatTreatment; readonly rate: string; readonly amount: string; readonly net: string } | null;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly shipmentId: string;
  readonly projectId: string;
  readonly document: { readonly id: string; readonly filename: string; readonly mediaType: string; readonly byteLength: number } | null;
  readonly pendingApprovalId: string | null;
  readonly requesterId: string | null;
  readonly lastDecision: { readonly decision: string; readonly comment: string | null; readonly approverName: string | null } | null;
  readonly cancellationReason: string | null;
  readonly version: number;
}

export interface SalesInvoicePrintData {
  readonly invoice: InvoiceSummary;
  readonly seller: { readonly name: string; readonly nameAr: string | null; readonly address: string | null; readonly taxNumber: string | null };
  /** Everything from the company settings that prints on documents. */
  readonly company: CompanyDocumentProfile;
  readonly buyer: { readonly reference: string; readonly name: string; readonly nameAr: string | null; readonly address: string | null; readonly taxNumber: string | null; readonly paymentTermsDays: number };
  readonly project: { readonly reference: string };
  readonly shipment: { readonly reference: string; readonly customerPurchaseOrder: string | null; readonly containers: readonly string[]; readonly route: string; readonly incoterm: string };
  readonly product: { readonly name: string; readonly nameAr: string | null };
  readonly lines: readonly { readonly lineNo: number; readonly description: string; readonly quantity: string; readonly unitPrice: string; readonly lineAmount: string }[];
  readonly paymentTerms: string;
  readonly issuedAt: string | null;
  readonly issuedByName: string | null;
}

export interface InvoiceApprovalItem {
  readonly id: string;
  readonly actionCode: "SUPPLIER_INVOICE_CONFIRMATION";
  readonly subjectType: "SUPPLIER_INVOICE";
  readonly subjectId: string;
  readonly subjectReference: string;
  readonly shipmentId: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly quantity: string;
  readonly amount: string;
  readonly expectedAmount: string;
  /** Customer invoices: VAT treatment, rate and amount (amount = net + VAT). Null for supplier invoices. */
  readonly vat?: { readonly treatment: VatTreatment; readonly rate: string; readonly amount: string; readonly net: string } | null;
  readonly currency: string;
  readonly supplierName: string;
  readonly requesterId: string;
  readonly requesterName: string;
  readonly requestedAt: string | null;
}

const money = (value: unknown) => Number(value ?? 0).toFixed(2);
const six = (value: unknown) => Number(value ?? 0).toFixed(6);
const day = (value: unknown) => (value ? new Date(value as string).toISOString().slice(0, 10) : "");
const ACTIVE_SHIPMENT_STATES = { SUPPLIER: ["CONFIRMED", "IN_TRANSIT", "RECEIVED"], SALES: ["CONFIRMED", "IN_TRANSIT", "DELIVERED"] } as const;

function formatAddress(value: unknown): string | null {
  if (!value || typeof value !== "object") return typeof value === "string" && value.trim() ? value : null;
  const a = value as Record<string, unknown>;
  const parts = [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" "), a.region].filter((part) => typeof part === "string" && part.trim());
  return parts.length ? parts.join(", ") : null;
}

/** The company settings as printed on documents; the company name falls back to the account name. */
export async function companyDocumentProfile(client: SqlTransaction, tenantId: string): Promise<CompanyDocumentProfile> {
  const row = (await client.$queryRawUnsafe<Array<{ name: string; profile: { company?: Record<string, unknown>; print?: { showLogo?: boolean } } | null; logo: Buffer | null; logo_media_type: string | null }>>(
    `SELECT t."name", p."profile", p."logo", p."logo_media_type" FROM "Tenant" t LEFT JOIN "CompanyProfile" p ON p."tenant_id" = t."id" WHERE t."id" = $1`, tenantId))[0];
  const c = (row?.profile?.company ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof c[key] === "string" ? String(c[key]) : "");
  const showLogo = row?.profile?.print?.showLogo !== false;
  return {
    legalNameEn: text("legalNameEn") || String(row?.name ?? ""), legalNameAr: text("legalNameAr"), addressEn: text("addressEn"), addressAr: text("addressAr"),
    phone: text("phone"), email: text("email"), website: text("website"), trn: text("trn"), licenceNo: text("licenceNo"),
    bankName: text("bankName"), bankAccountName: text("bankAccountName"), iban: text("iban"), swift: text("swift"), bankCurrency: text("bankCurrency"),
    termsEn: text("termsEn"), termsAr: text("termsAr"), footerEn: text("footerEn"), footerAr: text("footerAr"),
    brandColor: /^#[0-9a-fA-F]{6}$/.test(text("brandColor")) ? text("brandColor") : "#1f4e79",
    documentLanguage: (["BILINGUAL", "EN", "AR"].includes(text("documentLanguage")) ? text("documentLanguage") : "BILINGUAL") as CompanyDocumentProfile["documentLanguage"],
    vatRegistered: c.vatRegistered === true,
    logoDataUrl: showLogo && row?.logo && row.logo_media_type ? `data:${row.logo_media_type};base64,${Buffer.from(row.logo).toString("base64")}` : null,
  };
}

async function uuid(tx: SqlTransaction): Promise<string> {
  return (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT orb_uuidv7()::text id`))[0].id;
}

export class PrismaInvoiceStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  private async audit(tx: SqlTransaction, input: { tenantId: string; projectId: string; type: InvoiceType; invoiceId: string; actorId: string; action: string; details: Record<string, unknown> }) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "InvoiceAuditEvent" ("tenant_id","project_id","invoice_type","invoice_id","actor_id","action","details") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      input.tenantId, input.projectId, input.type, input.invoiceId, input.actorId, input.action, JSON.stringify(input.details));
  }

  // ---------------- reads ----------------

  async listForShipment(tenantId: string, type: InvoiceType, shipmentId: string): Promise<InvoiceSummary[]> {
    const ids = await this.client.$queryRawUnsafe<Array<{ id: string }>>(
      type === "SUPPLIER"
        ? `SELECT "id" FROM "SupplierInvoice" WHERE "tenant_id" = $1 AND "supplier_shipment_id" = $2 ORDER BY "id" DESC`
        : `SELECT "id" FROM "SalesInvoice" WHERE "tenant_id" = $1 AND "sales_shipment_id" = $2 ORDER BY "id" DESC`, tenantId, shipmentId);
    return Promise.all(ids.map((row) => this.summary(this.client, tenantId, type, row.id)));
  }

  async get(tenantId: string, type: InvoiceType, invoiceId: string): Promise<InvoiceSummary> {
    return this.summary(this.client, tenantId, type, invoiceId);
  }

  async summary(tx: SqlTransaction, tenantId: string, type: InvoiceType, invoiceId: string): Promise<InvoiceSummary> {
    const row = type === "SUPPLIER"
      ? (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT i."id", i."reference", i."invoice_date", i."state"::text state, i."currency", i."amount"::text amount, i."supplier_shipment_id" shipment_id, i."project_id",
                i."approval_id", i."cancellation_reason", i."version", l."quantity"::text quantity, l."unit_price"::text unit_price, l."line_amount"::text line_amount,
                e."id" evidence_id, e."original_filename", e."media_type", e."byte_length"
           FROM "SupplierInvoice" i JOIN "SupplierInvoiceLine" l ON l."supplier_invoice_id" = i."id" LEFT JOIN "EvidenceObject" e ON e."id" = i."evidence_id"
          WHERE i."tenant_id" = $1 AND i."id" = $2`, tenantId, invoiceId))[0]
      : (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT i."id", i."reference", i."invoice_date", i."state"::text state, i."currency", (SUM(l."line_amount") + i."vat_amount")::text amount, i."sales_shipment_id" shipment_id, i."project_id",
                i."vat_treatment", i."vat_rate"::text vat_rate, i."vat_amount"::text vat_amount,
                i."approval_id", i."cancellation_reason", i."version", SUM(l."quantity")::text quantity, MAX(l."unit_price")::text unit_price, SUM(l."line_amount")::text line_amount,
                NULL::uuid evidence_id, NULL original_filename, NULL media_type, NULL::bigint byte_length
           FROM "SalesInvoice" i JOIN "SalesInvoiceLine" l ON l."sales_invoice_id" = i."id"
          WHERE i."tenant_id" = $1 AND i."id" = $2 GROUP BY i."id"`, tenantId, invoiceId))[0];
    if (!row) throw new InvoiceStoreError("NOT_FOUND", "Invoice not found");
    const approvals = type === "SUPPLIER" ? await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."decision"::text decision, ap."requester_id", ap."comment", u."name_en" approver_name FROM "Approval" ap LEFT JOIN "User" u ON u."id" = ap."approver_id"
        WHERE ap."action_code" = 'SUPPLIER_INVOICE_CONFIRMATION' AND ap."subject_id" = $1 ORDER BY ap."id" DESC`, invoiceId) : [];
    const pending = approvals.find((a) => a.decision === "PENDING");
    const decided = approvals.find((a) => a.decision === "APPROVED" || a.decision === "REJECTED");
    const paid = (await tx.$queryRawUnsafe<Array<{ paid: string }>>(
      `SELECT COALESCE(SUM("amount"), 0)::text paid FROM "SettlementAllocation" WHERE "target_type" = $1::"AllocationTargetType" AND "target_id" = $2 AND "state" = 'ACTIVE'`,
      type === "SUPPLIER" ? "SUPPLIER_INVOICE" : "CINV", invoiceId))[0].paid;
    return {
      paid: money(paid), outstanding: (Math.round(Number(row.amount) * 100 - Number(paid) * 100) / 100).toFixed(2),
      type, id: String(row.id), reference: String(row.reference), invoiceDate: day(row.invoice_date), state: String(row.state), currency: String(row.currency).trim(),
      amount: money(row.amount), expectedAmount: money(row.line_amount), quantity: six(row.quantity), unitPrice: six(row.unit_price),
      vat: type === "SALES" ? { treatment: String(row.vat_treatment) as VatTreatment, rate: Number(row.vat_rate).toFixed(2), amount: money(row.vat_amount), net: money(row.line_amount) } : null,
      shipmentId: String(row.shipment_id), projectId: String(row.project_id),
      document: row.evidence_id ? { id: String(row.evidence_id), filename: String(row.original_filename), mediaType: String(row.media_type), byteLength: Number(row.byte_length) } : null,
      pendingApprovalId: pending ? String(pending.id) : null, requesterId: pending ? String(pending.requester_id) : null,
      lastDecision: decided ? { decision: String(decided.decision), comment: decided.comment === null ? null : String(decided.comment), approverName: decided.approver_name === null ? null : String(decided.approver_name) } : null,
      cancellationReason: row.cancellation_reason === null ? null : String(row.cancellation_reason), version: Number(row.version),
    };
  }

  async printData(tenantId: string, invoiceId: string): Promise<SalesInvoicePrintData> {
    const invoice = await this.summary(this.client, tenantId, "SALES", invoiceId);
    const row = (await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c."reference" customer_reference, c."legal_name", c."legal_name_ar", c."billing_address", c."tax_registration_number", c."payment_terms_days",
              p."reference" project_reference, sh."reference" shipment_reference, d."customer_purchase_order_reference", d."container_numbers",
              d."load_location", d."load_country", d."destination_location", d."destination_country", d."incoterm", d."named_place",
              spec."name_en" product_name, spec."name_ar" product_name_ar, cv."payment_terms", i."issued_at", u."name_en" issued_by_name
         FROM "SalesInvoice" i
         JOIN "Customer" c ON c."id" = i."customer_master_id"
         JOIN "Project" p ON p."id" = i."project_id"
         JOIN "SalesShipment" sh ON sh."id" = i."sales_shipment_id"
         JOIN "SalesShipmentDataset" d ON d."id" = i."sales_shipment_dataset_id"
         JOIN "CoffeeSpecification" spec ON spec."id" = d."coffee_specification_id"
         JOIN "ContractVersion" cv ON cv."id" = d."sales_contract_version_id"
         LEFT JOIN "User" u ON u."id" = i."issued_by"
        WHERE i."tenant_id" = $1 AND i."id" = $2`, tenantId, invoiceId))[0];
    if (!row) throw new InvoiceStoreError("NOT_FOUND", "Invoice not found");
    const company = await companyDocumentProfile(this.client, tenantId);
    const lines = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "line_no", "description", "quantity"::text quantity, "unit_price"::text unit_price, "line_amount"::text line_amount FROM "SalesInvoiceLine" WHERE "sales_invoice_id" = $1 ORDER BY "line_no"`, invoiceId);
    const str = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));
    return {
      invoice,
      seller: { name: company.legalNameEn, nameAr: str(company.legalNameAr), address: str(company.addressEn), taxNumber: str(company.trn) },
      company,
      buyer: { reference: String(row.customer_reference), name: String(row.legal_name), nameAr: str(row.legal_name_ar), address: formatAddress(row.billing_address), taxNumber: str(row.tax_registration_number), paymentTermsDays: Number(row.payment_terms_days ?? 0) },
      project: { reference: String(row.project_reference) },
      shipment: { reference: String(row.shipment_reference), customerPurchaseOrder: str(row.customer_purchase_order_reference), containers: (row.container_numbers as string[]) ?? [], route: `${row.load_location}, ${row.load_country} → ${row.destination_location}, ${row.destination_country}`, incoterm: `${row.incoterm} ${row.named_place}` },
      product: { name: String(row.product_name), nameAr: str(row.product_name_ar) },
      lines: lines.map((line) => ({ lineNo: Number(line.line_no), description: String(line.description), quantity: six(line.quantity), unitPrice: six(line.unit_price), lineAmount: money(line.line_amount) })),
      paymentTerms: String(row.payment_terms ?? ""),
      issuedAt: row.issued_at ? new Date(row.issued_at as string).toISOString() : null,
      issuedByName: str(row.issued_by_name),
    };
  }

  async listPendingApprovals(tenantId: string): Promise<InvoiceApprovalItem[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."subject_id", ap."requester_id", u."name_en" requester_name, i."reference", i."supplier_shipment_id", i."project_id", p."reference" project_reference,
              i."amount"::text amount, i."currency", l."line_amount"::text expected, l."quantity"::text quantity, s."registered_name" supplier_name
         FROM "Approval" ap JOIN "SupplierInvoice" i ON i."id" = ap."subject_id" AND i."tenant_id" = $1
         JOIN "SupplierInvoiceLine" l ON l."supplier_invoice_id" = i."id" JOIN "Project" p ON p."id" = i."project_id"
         JOIN "Supplier" s ON s."id" = i."supplier_master_id" JOIN "User" u ON u."id" = ap."requester_id"
        WHERE ap."action_code" = 'SUPPLIER_INVOICE_CONFIRMATION' AND ap."decision" = 'PENDING' ORDER BY ap."id"`, tenantId);
    return rows.map((r) => ({
      id: String(r.id), actionCode: "SUPPLIER_INVOICE_CONFIRMATION", subjectType: "SUPPLIER_INVOICE", subjectId: String(r.subject_id), subjectReference: String(r.reference), shipmentId: String(r.supplier_shipment_id),
      projectId: String(r.project_id), projectReference: String(r.project_reference), quantity: six(r.quantity), amount: money(r.amount), expectedAmount: money(r.expected),
      currency: String(r.currency).trim(), supplierName: String(r.supplier_name), requesterId: String(r.requester_id), requesterName: String(r.requester_name), requestedAt: uuidV7Time(String(r.id)),
    }));
  }

  async approvalSubject(tenantId: string, approvalId: string): Promise<{ invoiceId: string } | null> {
    const row = (await this.client.$queryRawUnsafe<Array<{ subject_id: string }>>(
      `SELECT ap."subject_id"::text subject_id FROM "Approval" ap JOIN "SupplierInvoice" i ON i."id" = ap."subject_id" AND i."tenant_id" = $2
        WHERE ap."id" = $1 AND ap."action_code" = 'SUPPLIER_INVOICE_CONFIRMATION'`, approvalId, tenantId))[0];
    return row ? { invoiceId: row.subject_id } : null;
  }

  // ---------------- supplier invoices ----------------

  async createSupplierInvoice(input: { tenantId: string; actorId: string; shipmentId: string; reference: string; invoiceDate: string; amount: string; document: UploadedDocument }): Promise<InvoiceSummary> {
    // Validate the shipment before storing the file, so a refused request leaves nothing behind.
    const shipment = await this.supplierShipmentContext(this.client, input.tenantId, input.shipmentId, false);
    const evidenceId = await uuid(this.client);
    const stored = await putDocument(input.document, evidenceId);
    return this.client.$transaction(async (tx) => {
      const s = await this.supplierShipmentContext(tx, input.tenantId, input.shipmentId, true);
      if (s.dataset_id !== shipment.dataset_id) throw new InvoiceStoreError("CONFLICT", "The shipment changed while the invoice was being uploaded. Try again.");
      const invoiceId = await uuid(tx);
      await recordDocument(tx, { evidenceId, projectId: s.project_id, actorId: input.actorId, document: input.document, stored, subjectType: "SUPPLIER_INVOICE", subjectId: invoiceId, purpose: "SUPPLIER_INVOICE_DOCUMENT", parentType: "PROJECT", parentId: s.project_id });
      await tx.$executeRawUnsafe(
        `INSERT INTO "SupplierInvoice" ("id","project_id","supplier_shipment_id","tenant_id","supplier_master_id","reference","invoice_date","amount","currency","evidence_id","state")
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::numeric,$9,$10,'DRAFT')`,
        invoiceId, s.project_id, input.shipmentId, input.tenantId, s.supplier_id, input.reference, input.invoiceDate, input.amount, s.currency, evidenceId);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SupplierInvoiceLine" ("supplier_invoice_id","supplier_shipment_id","supplier_shipment_dataset_id","line_no","description","quantity","unit_price","line_amount")
         VALUES ($1,$2,$3,1,$4,$5::numeric,$6::numeric,ROUND($5::numeric * $6::numeric, 6))`,
        invoiceId, input.shipmentId, s.dataset_id, `${s.product_name} — ${s.reference}`, s.quantity, s.unit_price);
      await this.audit(tx, { tenantId: input.tenantId, projectId: s.project_id, type: "SUPPLIER", invoiceId, actorId: input.actorId, action: "CREATED", details: { reference: input.reference, amount: input.amount, evidenceId } });
      await this.confirmSupplierInvoiceTx(tx, input.tenantId, input.actorId, invoiceId);
      return this.summary(tx, input.tenantId, "SUPPLIER", invoiceId);
    }).catch((error: { code?: string; meta?: unknown; message?: string }) => {
      if (String(error?.message ?? "").includes("SupplierInvoice_one_active_per_shipment")) throw new InvoiceStoreError("CONFLICT", "This shipment already has an active supplier invoice.");
      if (String(error?.message ?? "").includes("SupplierInvoice_supplier_master_reference_key")) throw new InvoiceStoreError("CONFLICT", "This supplier invoice number is already recorded.");
      throw error;
    });
  }

  private async supplierShipmentContext(tx: SqlTransaction, tenantId: string, shipmentId: string, lock: boolean) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT sh."project_id", sh."reference", sh."execution_state"::text execution_state, d."id" dataset_id, d."supplier_master_id" supplier_id, d."quantity"::text quantity,
              cv."unit_price"::text unit_price, cv."currency", spec."name_en" product_name,
              (SELECT count(*) FROM "SupplierInvoice" x WHERE x."supplier_shipment_id" = sh."id" AND x."state" NOT IN ('CANCELLED','REJECTED'))::int active_invoices
         FROM "SupplierShipment" sh JOIN "SupplierShipmentDataset" d ON d."id" = sh."active_dataset_id"
         JOIN "ContractVersion" cv ON cv."id" = d."purchase_contract_version_id" JOIN "CoffeeSpecification" spec ON spec."id" = d."coffee_specification_id"
        WHERE sh."tenant_id" = $1 AND sh."id" = $2 ${lock ? `FOR UPDATE OF sh` : ""}`, tenantId, shipmentId))[0];
    if (!row) throw new InvoiceStoreError("NOT_FOUND", "Shipment not found");
    if (!(ACTIVE_SHIPMENT_STATES.SUPPLIER as readonly string[]).includes(row.execution_state)) throw new InvoiceStoreError("CONFLICT", "A supplier invoice can only be recorded for a confirmed, in-transit or received shipment.");
    if (Number(row.active_invoices) > 0) throw new InvoiceStoreError("CONFLICT", "This shipment already has an active supplier invoice.");
    return row;
  }

  private async lockSupplierInvoice(tx: SqlTransaction, tenantId: string, invoiceId: string) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "project_id", "state"::text state, "approval_id", "version", row_to_json(i)::text json FROM "SupplierInvoice" i WHERE "tenant_id" = $1 AND "id" = $2 FOR UPDATE`, tenantId, invoiceId))[0];
    if (!row) throw new InvoiceStoreError("NOT_FOUND", "Invoice not found");
    return row;
  }

  /** A bill counts as soon as it is saved: no approval step. The Approval row records who confirmed it, bound to the bill's content hash. */
  private async confirmSupplierInvoiceTx(tx: SqlTransaction, tenantId: string, actorId: string, invoiceId: string) {
    const invoice = await this.lockSupplierInvoice(tx, tenantId, invoiceId);
    if (invoice.state !== "DRAFT") throw new InvoiceStoreError("CONFLICT", invoice.state === "CONFIRMED" ? "This bill is already confirmed." : "Only a draft bill can be confirmed.");
    const approvalId = (await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Approval" ("action_code","subject_type","subject_id","subject_version","subject_hash","requester_id","decision","decided_at","comment")
       VALUES ('SUPPLIER_INVOICE_CONFIRMATION','SUPPLIER_INVOICE',$1,$2,$3,$4,'APPROVED',NOW(),'Saved') RETURNING "id"::text id`,
      invoiceId, Number(invoice.version) + 1, createHash("sha256").update(String(invoice.json)).digest("hex"), actorId))[0].id;
    await tx.$executeRawUnsafe(`UPDATE "SupplierInvoice" SET "state" = 'CONFIRMED', "approval_id" = $2, "version" = "version" + 1 WHERE "id" = $1`, invoiceId, approvalId);
    await this.audit(tx, { tenantId, projectId: String(invoice.project_id), type: "SUPPLIER", invoiceId, actorId, action: "APPROVED", details: { approvalId, comment: "Saved" } });
  }

  async submitSupplierInvoice(input: { tenantId: string; actorId: string; invoiceId: string }): Promise<InvoiceSummary> {
    return this.client.$transaction(async (tx) => {
      await this.confirmSupplierInvoiceTx(tx, input.tenantId, input.actorId, input.invoiceId);
      return this.summary(tx, input.tenantId, "SUPPLIER", input.invoiceId);
    });
  }

  async decideSupplierInvoice(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null }): Promise<InvoiceSummary> {
    const subject = await this.approvalSubject(input.tenantId, input.approvalId);
    if (!subject) throw new InvoiceStoreError("NOT_FOUND", "Approval not found");
    return this.client.$transaction(async (tx) => {
      const invoice = await this.lockSupplierInvoice(tx, input.tenantId, subject.invoiceId);
      const approval = (await tx.$queryRawUnsafe<Array<{ decision: string; requester_id: string }>>(`SELECT "decision"::text decision, "requester_id" FROM "Approval" WHERE "id" = $1 FOR UPDATE`, input.approvalId))[0];
      if (!approval || approval.decision !== "PENDING" || invoice.approval_id !== input.approvalId) throw new InvoiceStoreError("CONFLICT", "This approval was already decided or withdrawn.");
      if (approval.requester_id === input.approverId) throw new InvoiceStoreError("INVALID", "You cannot approve your own request.");
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = $2::"ApprovalDecision", "approver_id" = $3, "decided_at" = NOW(), "comment" = $4 WHERE "id" = $1`, input.approvalId, input.decision, input.approverId, input.comment);
      await tx.$executeRawUnsafe(`UPDATE "SupplierInvoice" SET "state" = $2::"SupplierInvoiceState", "version" = "version" + 1 WHERE "id" = $1`, subject.invoiceId, input.decision === "APPROVED" ? "CONFIRMED" : "REJECTED");
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(invoice.project_id), type: "SUPPLIER", invoiceId: subject.invoiceId, actorId: input.approverId, action: input.decision, details: { approvalId: input.approvalId, comment: input.comment } });
      return this.summary(tx, input.tenantId, "SUPPLIER", subject.invoiceId);
    });
  }

  async cancelSupplierInvoice(input: { tenantId: string; actorId: string; invoiceId: string; reason: string }): Promise<InvoiceSummary> {
    return this.client.$transaction(async (tx) => {
      const invoice = await this.lockSupplierInvoice(tx, input.tenantId, input.invoiceId);
      if (!["DRAFT", "PENDING_APPROVAL", "CONFIRMED"].includes(String(invoice.state))) throw new InvoiceStoreError("CONFLICT", "This invoice is already closed.");
      if (invoice.state === "PENDING_APPROVAL" && invoice.approval_id) {
        await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = 'EXPIRED', "decided_at" = NOW() WHERE "id" = $1 AND "decision" = 'PENDING'`, invoice.approval_id);
      }
      const allocated = (await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int n FROM "SettlementAllocation" WHERE "target_type"::text = 'SUPPLIER_INVOICE' AND "target_id" = $1 AND "state"::text = 'ACTIVE'`, input.invoiceId))[0]?.n ?? 0;
      if (allocated > 0) throw new InvoiceStoreError("CONFLICT", "Payments are allocated to this invoice. Reverse them first.");
      await tx.$executeRawUnsafe(`UPDATE "SupplierInvoice" SET "state" = 'CANCELLED', "cancellation_reason" = $2, "version" = "version" + 1 WHERE "id" = $1`, input.invoiceId, input.reason);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(invoice.project_id), type: "SUPPLIER", invoiceId: input.invoiceId, actorId: input.actorId, action: "CANCELLED", details: { reason: input.reason, previousState: invoice.state } });
      return this.summary(tx, input.tenantId, "SUPPLIER", input.invoiceId);
    });
  }

  // ---------------- customer (sales) invoices ----------------

  /**
   * VAT, decided when the invoice is issued: a company that is not VAT registered issues out-of-scope invoices; a
   * registered one charges its standard rate to UAE customers and zero-rates customers abroad, unless the person
   * issuing chooses another treatment. The VAT is added to what the customer owes; revenue stays net.
   */
  async issueSalesInvoice(input: { tenantId: string; actorId: string; shipmentId: string; invoiceDate: string; vatTreatment?: VatTreatment | null }): Promise<InvoiceSummary> {
    return this.client.$transaction(async (tx) => {
      const s = (await tx.$queryRawUnsafe<Array<Record<string, string>>>(
        `SELECT sh."project_id", sh."reference", sh."execution_state"::text execution_state, d."id" dataset_id, d."customer_id", d."quantity"::text quantity,
                cv."unit_price"::text unit_price, cv."currency", spec."name_en" product_name,
                (SELECT count(*) FROM "SalesInvoice" x WHERE x."sales_shipment_id" = sh."id" AND x."state" <> 'CANCELLED')::int active_invoices
           FROM "SalesShipment" sh JOIN "SalesShipmentDataset" d ON d."id" = sh."active_dataset_id"
           JOIN "ContractVersion" cv ON cv."id" = d."sales_contract_version_id" JOIN "CoffeeSpecification" spec ON spec."id" = d."coffee_specification_id"
          WHERE sh."tenant_id" = $1 AND sh."id" = $2 FOR UPDATE OF sh`, input.tenantId, input.shipmentId))[0];
      if (!s) throw new InvoiceStoreError("NOT_FOUND", "Shipment not found");
      if (!(ACTIVE_SHIPMENT_STATES.SALES as readonly string[]).includes(s.execution_state)) throw new InvoiceStoreError("CONFLICT", "A customer invoice can only be issued for a confirmed, in-transit or delivered shipment.");
      if (Number(s.active_invoices) > 0) throw new InvoiceStoreError("CONFLICT", "This shipment already has an invoice. Cancel it first to issue a new one.");
      const year = input.invoiceDate.slice(0, 4), prefix = `ORB-INV-${year}-`;
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, `sales-invoice:${input.tenantId}:${year}`);
      const next = (await tx.$queryRawUnsafe<Array<{ next: number }>>(
        `SELECT (COALESCE(MAX(substring("reference" from '([0-9]{6})$')::bigint), 0) + 1)::int next FROM "SalesInvoice" WHERE "tenant_id" = $1 AND "reference" LIKE $2`, input.tenantId, `${prefix}%`))[0].next;
      const reference = `${prefix}${String(next).padStart(6, "0")}`;
      const invoiceId = await uuid(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SalesInvoice" ("id","project_id","sales_shipment_id","sales_shipment_dataset_id","tenant_id","customer_master_id","reference","invoice_date","currency","state","issued_at","issued_by")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,'ISSUED',NOW(),$10)`,
        invoiceId, s.project_id, input.shipmentId, s.dataset_id, input.tenantId, s.customer_id, reference, input.invoiceDate, s.currency, input.actorId);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SalesInvoiceLine" ("sales_invoice_id","sales_shipment_dataset_id","line_no","description","quantity","unit_price","line_amount")
         VALUES ($1,$2,1,$3,$4::numeric,$5::numeric,ROUND($4::numeric * $5::numeric, 6))`,
        invoiceId, s.dataset_id, `${s.product_name} — ${s.reference}`, s.quantity, s.unit_price);
      const facts = (await tx.$queryRawUnsafe<Array<{ profile: Record<string, unknown> | null; country: string | null }>>(
        `SELECT (SELECT "profile" FROM "CompanyProfile" WHERE "tenant_id" = $1) profile, c."country_code" country FROM "Customer" c WHERE c."id" = $2`, input.tenantId, s.customer_id))[0];
      const company = (facts?.profile?.company ?? {}) as { vatRegistered?: boolean; standardVatRate?: string };
      const treatment: VatTreatment = input.vatTreatment ?? (!company.vatRegistered ? "OUT_OF_SCOPE" : (facts?.country ?? "").toUpperCase() === "AE" ? "STANDARD" : "ZERO_RATED");
      const rate = treatment === "STANDARD" ? Number(company.standardVatRate ?? "5") : 0;
      await tx.$executeRawUnsafe(
        `UPDATE "SalesInvoice" i SET "vat_treatment" = $2, "vat_rate" = $3::numeric,
                "vat_amount" = ROUND((SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id") * $3::numeric / 100, 2)
          WHERE i."id" = $1`, invoiceId, treatment, rate.toFixed(2));
      await this.audit(tx, { tenantId: input.tenantId, projectId: s.project_id, type: "SALES", invoiceId, actorId: input.actorId, action: "ISSUED", details: { reference, invoiceDate: input.invoiceDate } });
      return this.summary(tx, input.tenantId, "SALES", invoiceId);
    });
  }

  async cancelSalesInvoice(input: { tenantId: string; actorId: string; invoiceId: string; reason: string }): Promise<InvoiceSummary> {
    return this.client.$transaction(async (tx) => {
      const invoice = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT "project_id", "state"::text state FROM "SalesInvoice" WHERE "tenant_id" = $1 AND "id" = $2 FOR UPDATE`, input.tenantId, input.invoiceId))[0];
      if (!invoice) throw new InvoiceStoreError("NOT_FOUND", "Invoice not found");
      if (invoice.state === "CANCELLED") throw new InvoiceStoreError("CONFLICT", "This invoice is already cancelled.");
      const allocated = (await tx.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int n FROM "SettlementAllocation" WHERE "target_type"::text = 'CINV' AND "target_id" = $1 AND "state"::text = 'ACTIVE'`, input.invoiceId))[0]?.n ?? 0;
      if (allocated > 0) throw new InvoiceStoreError("CONFLICT", "Collections are allocated to this invoice. Reverse them first.");
      await tx.$executeRawUnsafe(`UPDATE "SalesInvoice" SET "state" = 'CANCELLED', "cancellation_reason" = $2, "version" = "version" + 1 WHERE "id" = $1`, input.invoiceId, input.reason);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(invoice.project_id), type: "SALES", invoiceId: input.invoiceId, actorId: input.actorId, action: "CANCELLED", details: { reason: input.reason } });
      return this.summary(tx, input.tenantId, "SALES", input.invoiceId);
    });
  }
}
