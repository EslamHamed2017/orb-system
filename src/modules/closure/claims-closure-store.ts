import { createHash } from "node:crypto";
import type { SqlClient, SqlTransaction } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { uuidV7Time } from "../shipments/execution/shipment-kinds.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { putDocument, recordDocument, type UploadedDocument } from "../evidence/document-storage.ts";

/**
 * Claims and project closure on PostgreSQL.
 *
 * Claims — raised on one shipment, with the evidence attached:
 *   customer claim (on a customer shipment): the customer claims against us; a settled amount lowers revenue.
 *   supplier claim (on a supplier shipment): we claim against the supplier; a settled amount lowers cost.
 *   OPEN → UNDER_REVIEW → outcome proposed (settled with an amount, or rejected/withdrawn with a reason)
 *     → another owner approves → RESOLVED / REJECTED. A returned proposal leaves the claim under review.
 *
 * Closure — a checklist taken from the live records:
 *   every shipment delivered / received, invoiced (issued / approved) and fully paid, no pending approvals, no open claims.
 *   Each blocker may be accepted with a written reason. Final close goes to another owner; when approved the project
 *   is read-only (the database refuses changes to its trade records). Reopening needs a reason and another owner.
 */

export class ClaimsClosureError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID";
  constructor(code: ClaimsClosureError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type ClaimSide = "CUSTOMER" | "SUPPLIER";
export type ClaimType = "QUANTITY" | "WEIGHT" | "QUALITY" | "DELIVERY" | "PRICE" | "DOCUMENT";
export const CLAIM_TYPES: readonly ClaimType[] = ["QUANTITY", "WEIGHT", "QUALITY", "DELIVERY", "PRICE", "DOCUMENT"];

export interface DocumentRef { readonly id: string; readonly filename: string; readonly mediaType: string; readonly byteLength: number }

export interface ClaimProposal {
  readonly id: string; readonly outcome: "RESOLVED" | "REJECTED"; readonly amount: string | null; readonly reason: string;
  readonly state: string; readonly approvalId: string | null; readonly proposedById: string | null; readonly proposedByName: string; readonly proposedAt: string | null; readonly decisionComment: string | null;
}

export interface ClaimSummary {
  readonly id: string; readonly projectId: string; readonly side: ClaimSide; readonly type: ClaimType; readonly state: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  readonly shipmentId: string; readonly shipmentReference: string; readonly partyName: string; readonly description: string;
  readonly quantity: string | null; readonly amount: string | null; readonly currency: string | null; readonly settledAmount: string | null;
  readonly openedByName: string; readonly openedAt: string | null; readonly closedAt: string | null; readonly version: number;
  readonly document: DocumentRef | null; readonly proposal: ClaimProposal | null;
}

export interface ShipmentChoice { readonly id: string; readonly side: ClaimSide; readonly reference: string; readonly partyName: string }

export interface ProjectClaims {
  readonly project: ProjectHead; readonly claims: readonly ClaimSummary[]; readonly shipments: readonly ShipmentChoice[];
}

export interface ProjectHead {
  readonly id: string; readonly reference: string; readonly customerName: string; readonly currency: string; readonly lifecycleState: string;
  readonly finalState: "OPEN" | "FINAL_CLOSED"; readonly closedAt: string | null; readonly closedByName: string | null;
  readonly reopenedAt: string | null; readonly reopenReason: string | null; readonly version: number;
}

export type BlockerCode =
  | "SALES_SHIPMENT_NOT_DELIVERED" | "SUPPLIER_SHIPMENT_NOT_RECEIVED" | "SALES_SHIPMENT_NOT_INVOICED" | "SUPPLIER_SHIPMENT_NOT_INVOICED"
  | "SALES_INVOICE_NOT_ISSUED" | "SUPPLIER_INVOICE_NOT_APPROVED" | "SALES_INVOICE_UNPAID" | "SUPPLIER_INVOICE_UNPAID"
  | "APPROVAL_PENDING" | "CLAIM_OPEN";

export interface Blocker {
  readonly id: string; readonly code: BlockerCode; readonly subjectType: string; readonly subjectId: string; readonly reference: string;
  readonly detail: string; readonly href: string; readonly exceptionReason: string | null; readonly exceptionByName: string | null; readonly exceptionAt: string | null;
}

export interface ClosureState {
  readonly project: ProjectHead;
  readonly assessment: { readonly id: string; readonly assessedAt: string; readonly assessedByName: string | null; readonly blockers: readonly Blocker[]; readonly current: boolean } | null;
  readonly pending: { readonly approvalId: string; readonly action: "FINAL_CLOSE" | "REOPEN"; readonly requesterId: string; readonly requesterName: string; readonly requestedAt: string | null; readonly reason: string | null } | null;
  readonly lastDecision: { readonly action: string; readonly decision: string; readonly comment: string | null; readonly decidedAt: string | null } | null;
}

export interface ClaimClosureApprovalItem {
  readonly id: string; readonly actionCode: "CLAIM_OUTCOME" | "FINAL_CLOSE" | "REOPEN"; readonly subjectType: "CLAIM" | "PROJECT_CLOSE" | "PROJECT_REOPEN";
  readonly subjectId: string; readonly subjectReference: string; readonly projectId: string; readonly projectReference: string; readonly detail: string;
  readonly amount: string | null; readonly currency: string | null; readonly quantity: string; readonly requesterId: string; readonly requesterName: string; readonly requestedAt: string | null;
}

interface LiveBlocker { code: BlockerCode; subjectType: string; subjectId: string; reference: string; detail: string; href: string }

const str = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
const money = (value: unknown) => (value === null || value === undefined ? null : Number(value).toFixed(2));
const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const fmt = (c: number) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const key = (b: { code: string; subjectId: string }) => `${b.code}:${b.subjectId}`;

async function uuid(tx: SqlTransaction): Promise<string> {
  return (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT orb_uuidv7()::text id`))[0].id;
}

export class PrismaClaimsClosureStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  private async audit(tx: SqlTransaction, input: { tenantId: string; projectId: string; subjectType: "CLAIM" | "CLOSURE"; subjectId: string; actorId: string; action: string; details: Record<string, unknown> }) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "ClaimClosureAuditEvent" ("tenant_id","project_id","subject_type","subject_id","actor_id","action","details") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      input.tenantId, input.projectId, input.subjectType, input.subjectId, input.actorId, input.action, JSON.stringify(input.details));
  }

  private async requestApproval(tx: SqlTransaction, actionCode: "CLAIM_OUTCOME" | "FINAL_CLOSE" | "REOPEN", subjectType: string, subjectId: string, version: number, facts: unknown, requesterId: string, reason: string | null) {
    return (await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Approval" ("action_code","subject_type","subject_id","subject_version","subject_hash","requester_id","decision","reason")
       VALUES ($1::"ApprovalActionCode",$2,$3,$4,$5,$6,'PENDING',$7) RETURNING "id"::text id`,
      actionCode, subjectType, subjectId, version, createHash("sha256").update(JSON.stringify(facts)).digest("hex"), requesterId, reason))[0].id;
  }

  private async decideApproval(tx: SqlTransaction, approvalId: string, approverId: string, decision: "APPROVED" | "REJECTED", comment: string | null) {
    const approval = (await tx.$queryRawUnsafe<Array<{ decision: string; requester_id: string }>>(`SELECT "decision"::text decision, "requester_id"::text requester_id FROM "Approval" WHERE "id" = $1 FOR UPDATE`, approvalId))[0];
    if (!approval || approval.decision !== "PENDING") throw new ClaimsClosureError("CONFLICT", "This approval was already decided or withdrawn.");
    if (approval.requester_id === approverId) throw new ClaimsClosureError("INVALID", "You cannot approve your own request.");
    await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = $2::"ApprovalDecision", "approver_id" = $3, "decided_at" = NOW(), "comment" = $4 WHERE "id" = $1`, approvalId, decision, approverId, comment);
  }

  private async head(tx: SqlTransaction, tenantId: string, projectId: string, lock = false): Promise<ProjectHead> {
    const r = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p."id"::text id, p."reference", c."legal_name" customer_name, p."management_currency" currency, p."lifecycle_state"::text lifecycle_state,
              p."final_state"::text final_state, p."closed_at", u."name_en" closed_by_name, p."reopened_at", p."reopen_reason", p."version"
         FROM "Project" p JOIN "Customer" c ON c."id" = p."customer_master_id" LEFT JOIN "User" u ON u."id" = p."closed_by"
        WHERE p."id" = $1 AND p."tenant_id" = $2 ${lock ? "FOR UPDATE OF p" : ""}`, projectId, tenantId))[0];
    if (!r) throw new ClaimsClosureError("NOT_FOUND", "Project not found");
    return {
      id: String(r.id), reference: String(r.reference), customerName: String(r.customer_name), currency: String(r.currency).trim(), lifecycleState: String(r.lifecycle_state),
      finalState: r.final_state === "FINAL_CLOSED" ? "FINAL_CLOSED" : "OPEN", closedAt: iso(r.closed_at), closedByName: str(r.closed_by_name),
      reopenedAt: iso(r.reopened_at), reopenReason: str(r.reopen_reason), version: Number(r.version),
    };
  }

  private assertOpen(project: ProjectHead) {
    if (project.finalState === "FINAL_CLOSED") throw new ClaimsClosureError("CONFLICT", "This project is closed. Reopen it to make changes.");
    if (project.lifecycleState === "CANCELLED") throw new ClaimsClosureError("CONFLICT", "This project is cancelled.");
  }

  // ---------------- claims ----------------

  async projectClaims(tenantId: string, projectId: string): Promise<ProjectClaims> {
    const project = await this.head(this.client, tenantId, projectId);
    const [claims, shipments] = await Promise.all([this.claims(this.client, tenantId, projectId, null), this.shipmentChoices(this.client, tenantId, projectId)]);
    return { project, claims, shipments };
  }

  private async shipmentChoices(tx: SqlTransaction, tenantId: string, projectId: string): Promise<ShipmentChoice[]> {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT s."id"::text id, 'CUSTOMER' side, s."reference", c."legal_name" party
         FROM "SalesShipment" s JOIN "Project" p ON p."id" = s."project_id" JOIN "Customer" c ON c."id" = p."customer_master_id"
        WHERE s."tenant_id" = $1 AND s."project_id" = $2 AND s."execution_state"::text NOT IN ('DRAFT', 'CANCELLED', 'REJECTED')
       UNION ALL
       SELECT s."id"::text, 'SUPPLIER', s."reference", su."registered_name"
         FROM "SupplierShipment" s JOIN "Contract" k ON k."id" = s."purchase_contract_id" JOIN "Supplier" su ON su."id" = k."counterparty_supplier_id"
        WHERE s."tenant_id" = $1 AND s."project_id" = $2 AND s."execution_state"::text NOT IN ('DRAFT', 'CANCELLED', 'REJECTED')
        ORDER BY 2, 3`, tenantId, projectId);
    return rows.map((r) => ({ id: r.id, side: r.side as ClaimSide, reference: r.reference, partyName: r.party }));
  }

  private async claims(tx: SqlTransaction, tenantId: string, projectId: string | null, claimId: string | null): Promise<ClaimSummary[]> {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c."id"::text id, c."project_id"::text project_id, c."side", c."type"::text type, c."state"::text state,
              COALESCE(c."sales_shipment_id", c."supplier_shipment_id")::text shipment_id, COALESCE(ss."reference", sp."reference") shipment_reference,
              COALESCE(cu."legal_name", su."registered_name") party_name, c."description", c."quantity"::text quantity, c."amount"::text amount,
              btrim(c."currency") currency, c."settled_amount"::text settled_amount, ou."name_en" opened_by_name, c."opened_at", c."closed_at", c."version",
              e."id"::text evidence_id, e."original_filename", e."media_type", e."byte_length",
              pr."id"::text proposal_id, pr."proposed_outcome"::text proposed_outcome, pr."amount"::text proposal_amount, pr."reason" proposal_reason, pr."state"::text proposal_state,
              pr."approval_id"::text approval_id, pr."proposed_by"::text proposed_by, pu."name_en" proposed_by_name, pr."proposed_at", ap."comment" decision_comment
         FROM "Claim" c
         LEFT JOIN "SalesShipment" ss ON ss."id" = c."sales_shipment_id" LEFT JOIN "SupplierShipment" sp ON sp."id" = c."supplier_shipment_id"
         LEFT JOIN "Customer" cu ON cu."id" = c."customer_master_id" LEFT JOIN "Supplier" su ON su."id" = c."supplier_master_id"
         LEFT JOIN "User" ou ON ou."id" = c."opened_by" LEFT JOIN "EvidenceObject" e ON e."id" = c."evidence_id"
         LEFT JOIN LATERAL (SELECT * FROM "ClaimOutcomeProposal" x WHERE x."claim_id" = c."id" ORDER BY x."id" DESC LIMIT 1) pr ON TRUE
         LEFT JOIN "User" pu ON pu."id" = pr."proposed_by" LEFT JOIN "Approval" ap ON ap."id" = pr."approval_id"
        WHERE c."tenant_id" = $1 AND ($2::uuid IS NULL OR c."project_id" = $2::uuid) AND ($3::uuid IS NULL OR c."id" = $3::uuid)
        ORDER BY c."id" DESC`, tenantId, projectId, claimId);
    return rows.map((r) => ({
      id: String(r.id), projectId: String(r.project_id), side: r.side as ClaimSide, type: r.type as ClaimType, state: r.state as ClaimSummary["state"],
      shipmentId: String(r.shipment_id), shipmentReference: String(r.shipment_reference), partyName: String(r.party_name ?? ""), description: String(r.description),
      quantity: str(r.quantity), amount: money(r.amount), currency: str(r.currency), settledAmount: money(r.settled_amount),
      openedByName: String(r.opened_by_name ?? ""), openedAt: iso(r.opened_at), closedAt: iso(r.closed_at), version: Number(r.version),
      document: r.evidence_id ? { id: String(r.evidence_id), filename: String(r.original_filename), mediaType: String(r.media_type), byteLength: Number(r.byte_length) } : null,
      proposal: r.proposal_id ? {
        id: String(r.proposal_id), outcome: r.proposed_outcome as "RESOLVED" | "REJECTED", amount: money(r.proposal_amount), reason: String(r.proposal_reason ?? ""),
        state: String(r.proposal_state), approvalId: str(r.approval_id), proposedById: str(r.proposed_by), proposedByName: String(r.proposed_by_name ?? ""), proposedAt: iso(r.proposed_at), decisionComment: str(r.decision_comment),
      } : null,
    }));
  }

  async claim(tenantId: string, claimId: string): Promise<ClaimSummary> {
    const found = (await this.claims(this.client, tenantId, null, claimId))[0];
    if (!found) throw new ClaimsClosureError("NOT_FOUND", "Claim not found");
    return found;
  }

  private async lockClaim(tx: SqlTransaction, tenantId: string, claimId: string) {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id"::text id, "project_id"::text project_id, "state"::text state, "version", btrim("currency") currency FROM "Claim" WHERE "tenant_id" = $1 AND "id" = $2 FOR UPDATE`, tenantId, claimId))[0];
    if (!row) throw new ClaimsClosureError("NOT_FOUND", "Claim not found");
    return row;
  }

  async openClaim(input: {
    tenantId: string; actorId: string; projectId: string; shipmentId: string; type: ClaimType; description: string;
    quantity: string | null; amount: string | null; currency: string | null; document: UploadedDocument;
  }): Promise<ClaimSummary> {
    const check = async (tx: SqlTransaction) => {
      const project = await this.head(tx, input.tenantId, input.projectId, true);
      this.assertOpen(project);
      const shipment = (await this.shipmentChoices(tx, input.tenantId, input.projectId)).find((s) => s.id === input.shipmentId);
      if (!shipment) throw new ClaimsClosureError("INVALID", "Choose a confirmed shipment of this project.");
      return { project, shipment };
    };
    await check(this.client);
    const evidenceId = await uuid(this.client);
    const stored = await putDocument(input.document, evidenceId);
    const claimId = await this.client.$transaction(async (tx) => {
      const { project, shipment } = await check(tx);
      const id = await uuid(tx);
      await recordDocument(tx, { evidenceId, projectId: input.projectId, actorId: input.actorId, document: input.document, stored, subjectType: "CLAIM", subjectId: id, purpose: "CLAIM_EVIDENCE", parentType: "PROJECT", parentId: input.projectId });
      const master = shipment.side === "CUSTOMER"
        ? (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "customer_master_id"::text id FROM "Project" WHERE "id" = $1`, input.projectId))[0].id
        : (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT k."counterparty_supplier_id"::text id FROM "SupplierShipment" s JOIN "Contract" k ON k."id" = s."purchase_contract_id" WHERE s."id" = $1`, input.shipmentId))[0].id;
      await tx.$executeRawUnsafe(
        `INSERT INTO "Claim" ("id","project_id","tenant_id","side","sales_shipment_id","supplier_shipment_id","customer_master_id","supplier_master_id","type","description",
                              "quantity","amount","currency","evidence_id","state","opened_by","opened_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::"ClaimType",$10,$11::numeric,$12::numeric,$13,$14,'OPEN',$15,NOW())`,
        id, input.projectId, input.tenantId, shipment.side, shipment.side === "CUSTOMER" ? input.shipmentId : null, shipment.side === "SUPPLIER" ? input.shipmentId : null,
        shipment.side === "CUSTOMER" ? master : null, shipment.side === "SUPPLIER" ? master : null, input.type, input.description,
        input.quantity, input.amount, input.amount ? (input.currency ?? project.currency) : input.currency, evidenceId, input.actorId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "CLAIM", subjectId: id, actorId: input.actorId, action: "OPENED", details: { side: shipment.side, type: input.type, shipmentId: input.shipmentId, amount: input.amount } });
      return id;
    });
    return this.claim(input.tenantId, claimId);
  }

  async startReview(input: { tenantId: string; actorId: string; claimId: string; note: string | null }): Promise<ClaimSummary> {
    await this.client.$transaction(async (tx) => {
      const c = await this.lockClaim(tx, input.tenantId, input.claimId);
      this.assertOpen(await this.head(tx, input.tenantId, String(c.project_id)));
      if (c.state !== "OPEN") throw new ClaimsClosureError("CONFLICT", "Only an open claim can move to review.");
      await tx.$executeRawUnsafe(`UPDATE "Claim" SET "state" = 'UNDER_REVIEW', "version" = "version" + 1 WHERE "id" = $1`, input.claimId);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(c.project_id), subjectType: "CLAIM", subjectId: input.claimId, actorId: input.actorId, action: "UNDER_REVIEW", details: { note: input.note } });
    });
    return this.claim(input.tenantId, input.claimId);
  }

  async submitOutcome(input: { tenantId: string; actorId: string; claimId: string; outcome: "RESOLVED" | "REJECTED"; amount: string | null; currency: string | null; reason: string }): Promise<ClaimSummary & { approvalId: string }> {
    const approvalId = await this.client.$transaction(async (tx) => {
      const c = await this.lockClaim(tx, input.tenantId, input.claimId);
      const project = await this.head(tx, input.tenantId, String(c.project_id));
      this.assertOpen(project);
      if (c.state !== "UNDER_REVIEW") throw new ClaimsClosureError("CONFLICT", "Move the claim to review before proposing an outcome.");
      const pending = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "ClaimOutcomeProposal" WHERE "claim_id" = $1 AND "state" = 'PENDING_APPROVAL'`, input.claimId);
      if (pending.length) throw new ClaimsClosureError("CONFLICT", "An outcome for this claim is already waiting for approval.");
      const claimCurrency = str(c.currency);
      const cur = input.outcome === "RESOLVED" ? (claimCurrency ?? input.currency ?? project.currency) : null;
      if (input.outcome === "RESOLVED" && claimCurrency && input.currency && input.currency !== claimCurrency) throw new ClaimsClosureError("INVALID", `The settled amount must be in the claim currency (${claimCurrency}).`);
      const proposalId = await uuid(tx);
      const facts = { claimId: input.claimId, version: Number(c.version), outcome: input.outcome, amount: input.amount, currency: cur, reason: input.reason };
      const subjectHash = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
      await tx.$executeRawUnsafe(
        `INSERT INTO "ClaimOutcomeProposal" ("id","claim_id","claim_version","proposed_outcome","reason","subject_hash","state","tenant_id","amount","proposed_by","proposed_at")
         VALUES ($1,$2,$3,$4::"ClaimOutcome",$5,$6,'PENDING_APPROVAL',$7,$8::numeric,$9,NOW())`,
        proposalId, input.claimId, Number(c.version), input.outcome, input.reason, subjectHash, input.tenantId, input.outcome === "RESOLVED" ? input.amount : null, input.actorId);
      if (cur && !claimCurrency) await tx.$executeRawUnsafe(`UPDATE "Claim" SET "currency" = $2 WHERE "id" = $1`, input.claimId, cur);
      const approval = await this.requestApproval(tx, "CLAIM_OUTCOME", "CLAIM_OUTCOME", proposalId, Number(c.version), facts, input.actorId, input.reason);
      await tx.$executeRawUnsafe(`UPDATE "ClaimOutcomeProposal" SET "approval_id" = $2 WHERE "id" = $1`, proposalId, approval);
      await this.audit(tx, { tenantId: input.tenantId, projectId: String(c.project_id), subjectType: "CLAIM", subjectId: input.claimId, actorId: input.actorId, action: "OUTCOME_SUBMITTED", details: { ...facts, approvalId: approval } });
      return approval;
    });
    return { ...(await this.claim(input.tenantId, input.claimId)), approvalId };
  }

  /** Applies an approved outcome that was not applied yet (approval applies it at once; this is the safety net). */
  async applyOutcome(input: { tenantId: string; actorId: string; claimId: string }): Promise<ClaimSummary> {
    await this.client.$transaction(async (tx) => {
      const c = await this.lockClaim(tx, input.tenantId, input.claimId);
      const proposal = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id"::text id FROM "ClaimOutcomeProposal" WHERE "claim_id" = $1 AND "state" = 'APPROVED' AND "applied_at" IS NULL`, input.claimId))[0];
      if (!proposal) {
        if (c.state === "RESOLVED" || c.state === "REJECTED") return;
        throw new ClaimsClosureError("CONFLICT", "This claim has no approved outcome to apply.");
      }
      await this.apply(tx, input.tenantId, String(c.project_id), input.claimId, proposal.id, input.actorId);
    });
    return this.claim(input.tenantId, input.claimId);
  }

  private async apply(tx: SqlTransaction, tenantId: string, projectId: string, claimId: string, proposalId: string, actorId: string) {
    const p = (await tx.$queryRawUnsafe<Array<{ outcome: string; amount: string | null }>>(`SELECT "proposed_outcome"::text outcome, "amount"::text amount FROM "ClaimOutcomeProposal" WHERE "id" = $1`, proposalId))[0];
    await tx.$executeRawUnsafe(`UPDATE "Claim" SET "state" = $2::"ClaimState", "settled_amount" = $3::numeric, "closed_at" = NOW(), "version" = "version" + 1 WHERE "id" = $1`,
      claimId, p.outcome === "RESOLVED" ? "RESOLVED" : "REJECTED", p.outcome === "RESOLVED" ? p.amount : null);
    await tx.$executeRawUnsafe(`UPDATE "ClaimOutcomeProposal" SET "state" = 'APPLIED', "applied_at" = NOW() WHERE "id" = $1`, proposalId);
    await this.audit(tx, { tenantId, projectId, subjectType: "CLAIM", subjectId: claimId, actorId, action: "APPLIED", details: { proposalId, outcome: p.outcome, amount: p.amount } });
  }

  // ---------------- closure ----------------

  /** Everything that still stands between the project and closing, taken from the live records. */
  private async liveBlockers(tx: SqlTransaction, tenantId: string, projectId: string): Promise<LiveBlocker[]> {
    const q = <T>(sql: string) => tx.$queryRawUnsafe<T[]>(sql, tenantId, projectId);
    const [sales, supplier, salesInvoices, supplierInvoices, approvals, claims, claimCredits] = await Promise.all([
      q<Record<string, string>>(`SELECT s."id"::text id, s."reference", s."execution_state"::text state,
              EXISTS (SELECT 1 FROM "SalesInvoice" i WHERE i."sales_shipment_id" = s."id" AND i."state"::text <> 'CANCELLED')::text invoiced
         FROM "SalesShipment" s WHERE s."tenant_id" = $1 AND s."project_id" = $2 AND s."execution_state"::text NOT IN ('CANCELLED', 'REJECTED') ORDER BY s."reference"`),
      q<Record<string, string>>(`SELECT s."id"::text id, s."reference", s."execution_state"::text state,
              EXISTS (SELECT 1 FROM "SupplierInvoice" i WHERE i."supplier_shipment_id" = s."id" AND i."state"::text NOT IN ('CANCELLED', 'REJECTED'))::text invoiced
         FROM "SupplierShipment" s WHERE s."tenant_id" = $1 AND s."project_id" = $2 AND s."execution_state"::text NOT IN ('CANCELLED', 'REJECTED') ORDER BY s."reference"`),
      q<Record<string, string>>(`SELECT i."id"::text id, i."reference", i."state"::text state, btrim(i."currency") currency, i."sales_shipment_id"::text shipment_id,
              (SELECT SUM(l."line_amount") FROM "SalesInvoiceLine" l WHERE l."sales_invoice_id" = i."id")::text amount,
              COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'CINV' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text settled
         FROM "SalesInvoice" i WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text <> 'CANCELLED' ORDER BY i."reference"`),
      q<Record<string, string>>(`SELECT i."id"::text id, i."reference", i."state"::text state, btrim(i."currency") currency, i."supplier_shipment_id"::text shipment_id, i."amount"::text amount,
              COALESCE((SELECT SUM(a."amount") FROM "SettlementAllocation" a WHERE a."target_type" = 'SUPPLIER_INVOICE' AND a."target_id" = i."id" AND a."state" = 'ACTIVE'), 0)::text settled
         FROM "SupplierInvoice" i WHERE i."tenant_id" = $1 AND i."project_id" = $2 AND i."state"::text NOT IN ('CANCELLED', 'REJECTED') ORDER BY i."reference"`),
      q<Record<string, string>>(`SELECT 'MONEY_MOVEMENT' kind, m."id"::text id, m."reference" FROM "MoneyMovement" m WHERE m."tenant_id" = $1 AND m."project_id" = $2 AND m."state"::text = 'PENDING_APPROVAL'
       UNION ALL SELECT 'EXPENSE', x."id"::text, k."name_en" FROM "DirectExpense" x JOIN "ExpenseCategory" k ON k."code" = x."category_code" WHERE x."tenant_id" = $1 AND x."project_id" = $2 AND x."state"::text = 'PENDING_APPROVAL'
       UNION ALL SELECT 'CONTRACT', k."id"::text, k."reference" FROM "Contract" k JOIN "Approval" ap ON ap."subject_id" = k."id" AND ap."decision" = 'PENDING' WHERE k."tenant_id" = $1 AND k."project_id" = $2
       ORDER BY 1, 3`),
      q<Record<string, string>>(`SELECT c."id"::text id, COALESCE(ss."reference", sp."reference") reference, c."type"::text type, c."state"::text state
         FROM "Claim" c LEFT JOIN "SalesShipment" ss ON ss."id" = c."sales_shipment_id" LEFT JOIN "SupplierShipment" sp ON sp."id" = c."supplier_shipment_id"
        WHERE c."tenant_id" = $1 AND c."project_id" = $2 AND c."state"::text IN ('OPEN', 'UNDER_REVIEW') ORDER BY c."id"`),
      q<Record<string, string>>(`SELECT COALESCE(c."sales_shipment_id", c."supplier_shipment_id")::text shipment_id, btrim(c."currency") currency, SUM(c."settled_amount")::text amount
         FROM "Claim" c WHERE c."tenant_id" = $1 AND c."project_id" = $2 AND c."state"::text = 'RESOLVED' AND c."settled_amount" > 0 GROUP BY 1, 2`),
    ]);
    const out: LiveBlocker[] = [];
    for (const s of sales) {
      if (s.state === "DRAFT") out.push({ code: "SALES_SHIPMENT_NOT_DELIVERED", subjectType: "SALES_SHIPMENT", subjectId: s.id, reference: s.reference, detail: "Customer shipment is still a draft.", href: `/sales-shipments/${s.id}` });
      else if (s.state !== "DELIVERED") out.push({ code: "SALES_SHIPMENT_NOT_DELIVERED", subjectType: "SALES_SHIPMENT", subjectId: s.id, reference: s.reference, detail: `Customer shipment is ${s.state.replaceAll("_", " ").toLowerCase()}, not delivered.`, href: `/sales-shipments/${s.id}` });
      if (s.state !== "DRAFT" && s.invoiced !== "true") out.push({ code: "SALES_SHIPMENT_NOT_INVOICED", subjectType: "SALES_SHIPMENT", subjectId: s.id, reference: s.reference, detail: "No sales invoice for this customer shipment.", href: `/sales-shipments/${s.id}` });
    }
    for (const s of supplier) {
      if (s.state !== "RECEIVED") out.push({ code: "SUPPLIER_SHIPMENT_NOT_RECEIVED", subjectType: "SUPPLIER_SHIPMENT", subjectId: s.id, reference: s.reference, detail: s.state === "DRAFT" ? "Supplier shipment is still a draft." : `Supplier shipment is ${s.state.replaceAll("_", " ").toLowerCase()}, not received.`, href: `/supplier-shipments/${s.id}` });
      if (s.state !== "DRAFT" && s.invoiced !== "true") out.push({ code: "SUPPLIER_SHIPMENT_NOT_INVOICED", subjectType: "SUPPLIER_SHIPMENT", subjectId: s.id, reference: s.reference, detail: "No supplier invoice for this supplier shipment.", href: `/supplier-shipments/${s.id}` });
    }
    // Settled claims reduce what is still owed on that shipment's invoices, in the same currency.
    const credit = new Map(claimCredits.map((c) => [`${c.shipment_id}:${c.currency}`, cents(c.amount)]));
    const owed = (shipmentId: string, currency: string, amount: number) => {
      const k = `${shipmentId}:${currency}`, available = credit.get(k) ?? 0, used = Math.min(available, Math.max(amount, 0));
      credit.set(k, available - used);
      return amount - used;
    };
    for (const i of salesInvoices) {
      if (i.state !== "ISSUED") { out.push({ code: "SALES_INVOICE_NOT_ISSUED", subjectType: "SALES_INVOICE", subjectId: i.id, reference: i.reference, detail: i.state === "DRAFT" ? "Sales invoice is still a draft." : "Sales invoice is waiting for approval.", href: `/sales-shipments/${i.shipment_id}` }); continue; }
      const left = owed(i.shipment_id, i.currency, cents(i.amount) - cents(i.settled));
      if (left > 0) out.push({ code: "SALES_INVOICE_UNPAID", subjectType: "SALES_INVOICE", subjectId: i.id, reference: i.reference, detail: `${i.currency} ${fmt(left)} not collected yet.`, href: `/projects/${projectId}/money` });
    }
    for (const i of supplierInvoices) {
      if (i.state !== "CONFIRMED") { out.push({ code: "SUPPLIER_INVOICE_NOT_APPROVED", subjectType: "SUPPLIER_INVOICE", subjectId: i.id, reference: i.reference, detail: i.state === "DRAFT" ? "Supplier invoice is still a draft." : "Supplier invoice is waiting for approval.", href: `/supplier-shipments/${i.shipment_id}` }); continue; }
      const left = owed(i.shipment_id, i.currency, cents(i.amount) - cents(i.settled));
      if (left > 0) out.push({ code: "SUPPLIER_INVOICE_UNPAID", subjectType: "SUPPLIER_INVOICE", subjectId: i.id, reference: i.reference, detail: `${i.currency} ${fmt(left)} not paid yet.`, href: `/projects/${projectId}/money` });
    }
    for (const a of approvals) {
      const label = a.kind === "MONEY_MOVEMENT" ? "Payment" : a.kind === "EXPENSE" ? "Expense" : "Contract";
      out.push({ code: "APPROVAL_PENDING", subjectType: a.kind, subjectId: a.id, reference: a.reference, detail: `${label} is waiting for approval.`, href: a.kind === "MONEY_MOVEMENT" ? `/projects/${projectId}/money` : a.kind === "EXPENSE" ? `/projects/${projectId}/expenses` : "/approvals" });
    }
    for (const c of claims) out.push({ code: "CLAIM_OPEN", subjectType: "CLAIM", subjectId: c.id, reference: c.reference, detail: `${c.type.toLowerCase()} claim is ${c.state === "OPEN" ? "open" : "under review"}.`, href: `/projects/${projectId}/claims` });
    return out;
  }

  private hashOf(blockers: readonly { code: string; subjectId: string }[]) {
    return createHash("sha256").update(blockers.map(key).sort().join("\n")).digest("hex");
  }

  async closure(tenantId: string, projectId: string): Promise<ClosureState> {
    const project = await this.head(this.client, tenantId, projectId);
    const a = (await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT a."id"::text id, a."assessed_at", a."blockers_hash", u."name_en" assessed_by_name FROM "ClosureAssessment" a LEFT JOIN "User" u ON u."id" = a."assessed_by"
        WHERE a."tenant_id" = $1 AND a."project_id" = $2 ORDER BY a."assessed_at" DESC, a."id" DESC LIMIT 1`, tenantId, projectId))[0];
    let assessment: ClosureState["assessment"] = null;
    if (a) {
      const blockers = await this.blockers(this.client, String(a.id));
      const live = project.finalState === "OPEN" ? await this.liveBlockers(this.client, tenantId, projectId) : null;
      assessment = { id: String(a.id), assessedAt: String(iso(a.assessed_at)), assessedByName: str(a.assessed_by_name), blockers, current: live === null || this.hashOf(live) === a.blockers_hash };
    }
    const p = (await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id"::text id, ap."action_code"::text action, ap."requester_id"::text requester_id, u."name_en" requester_name, ap."reason"
         FROM "Approval" ap JOIN "User" u ON u."id" = ap."requester_id"
        WHERE ap."subject_type" = 'PROJECT' AND ap."subject_id" = $1 AND ap."action_code"::text IN ('FINAL_CLOSE', 'REOPEN') AND ap."decision" = 'PENDING' ORDER BY ap."id" DESC LIMIT 1`, projectId))[0];
    const d = (await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."action_code"::text action, ap."decision"::text decision, ap."comment", ap."decided_at" FROM "Approval" ap
        WHERE ap."subject_type" = 'PROJECT' AND ap."subject_id" = $1 AND ap."action_code"::text IN ('FINAL_CLOSE', 'REOPEN') AND ap."decision"::text IN ('APPROVED', 'REJECTED') ORDER BY ap."decided_at" DESC LIMIT 1`, projectId))[0];
    return {
      project, assessment,
      pending: p ? { approvalId: String(p.id), action: p.action as "FINAL_CLOSE" | "REOPEN", requesterId: String(p.requester_id), requesterName: String(p.requester_name), requestedAt: uuidV7Time(String(p.id)), reason: str(p.reason) } : null,
      lastDecision: d ? { action: String(d.action), decision: String(d.decision), comment: str(d.comment), decidedAt: iso(d.decided_at) } : null,
    };
  }

  private async blockers(tx: SqlTransaction, assessmentId: string): Promise<Blocker[]> {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT b."id"::text id, b."code", b."subject_type", b."subject_id"::text subject_id, b."message_key", b."exception_reason", u."name_en" exception_by_name, b."exception_at"
         FROM "ClosureBlocker" b LEFT JOIN "User" u ON u."id" = b."exception_by" WHERE b."assessment_id" = $1 ORDER BY b."id"`, assessmentId);
    return rows.map((r) => {
      const meta = JSON.parse(String(r.message_key)) as { reference: string; detail: string; href: string };
      return { id: String(r.id), code: r.code as BlockerCode, subjectType: String(r.subject_type), subjectId: String(r.subject_id), reference: meta.reference, detail: meta.detail, href: meta.href,
        exceptionReason: str(r.exception_reason), exceptionByName: str(r.exception_by_name), exceptionAt: iso(r.exception_at) };
    });
  }

  async assess(input: { tenantId: string; actorId: string; projectId: string }): Promise<ClosureState> {
    await this.client.$transaction(async (tx) => {
      const project = await this.head(tx, input.tenantId, input.projectId, true);
      this.assertOpen(project);
      if (project.lifecycleState !== "ACTIVE") throw new ClaimsClosureError("CONFLICT", "Only an active project can be closed.");
      const live = await this.liveBlockers(tx, input.tenantId, input.projectId);
      const has = (...codes: BlockerCode[]) => live.some((b) => codes.includes(b.code));
      const id = await uuid(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "ClosureAssessment" ("id","project_id","project_version","assessed_at","quantity_delivery_complete","route_complete","documents_complete","supplier_obligations_complete",
                                          "expenses_complete","claims_complete","approvals_complete","blockers_hash","tenant_id","assessed_by")
         VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        id, input.projectId, project.version, !has("SALES_SHIPMENT_NOT_DELIVERED"), !has("SUPPLIER_SHIPMENT_NOT_RECEIVED"),
        !has("SALES_SHIPMENT_NOT_INVOICED", "SUPPLIER_SHIPMENT_NOT_INVOICED", "SALES_INVOICE_NOT_ISSUED", "SUPPLIER_INVOICE_NOT_APPROVED"),
        !has("SUPPLIER_INVOICE_UNPAID", "SALES_INVOICE_UNPAID"), !live.some((b) => b.subjectType === "EXPENSE"), !has("CLAIM_OPEN"), !has("APPROVAL_PENDING"),
        this.hashOf(live), input.tenantId, input.actorId);
      for (const b of live) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "ClosureBlocker" ("assessment_id","code","subject_type","subject_id","message_key","exception_eligible") VALUES ($1,$2,$3,$4,$5,TRUE)`,
          id, b.code, b.subjectType, b.subjectId, JSON.stringify({ reference: b.reference, detail: b.detail, href: b.href }));
      }
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "CLOSURE", subjectId: id, actorId: input.actorId, action: "ASSESSED", details: { blockers: live.length } });
    });
    return this.closure(input.tenantId, input.projectId);
  }

  private async latestAssessment(tx: SqlTransaction, tenantId: string, projectId: string, assessmentId: string) {
    const latest = (await tx.$queryRawUnsafe<Array<{ id: string; blockers_hash: string }>>(
      `SELECT "id"::text id, "blockers_hash" FROM "ClosureAssessment" WHERE "tenant_id" = $1 AND "project_id" = $2 ORDER BY "assessed_at" DESC, "id" DESC LIMIT 1`, tenantId, projectId))[0];
    if (!latest || latest.id !== assessmentId) throw new ClaimsClosureError("CONFLICT", "A newer closure check exists. Use the latest check.");
    return latest;
  }

  async recordExceptions(input: { tenantId: string; actorId: string; projectId: string; assessmentId: string; blockerIds: readonly string[]; reason: string }): Promise<ClosureState> {
    await this.client.$transaction(async (tx) => {
      const project = await this.head(tx, input.tenantId, input.projectId, true);
      this.assertOpen(project);
      await this.latestAssessment(tx, input.tenantId, input.projectId, input.assessmentId);
      const pending = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "Approval" WHERE "subject_type" = 'PROJECT' AND "subject_id" = $1 AND "action_code"::text = 'FINAL_CLOSE' AND "decision" = 'PENDING'`, input.projectId);
      if (pending.length) throw new ClaimsClosureError("CONFLICT", "Closing is already waiting for approval.");
      for (const blockerId of input.blockerIds) {
        const changed = await tx.$executeRawUnsafe(
          `UPDATE "ClosureBlocker" SET "exception_reason" = $3, "exception_by" = $4, "exception_at" = NOW() WHERE "id" = $1 AND "assessment_id" = $2 AND "covered_by_approval_id" IS NULL`,
          blockerId, input.assessmentId, input.reason, input.actorId);
        if (!changed) throw new ClaimsClosureError("INVALID", "That item is not on this closure check.");
      }
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "CLOSURE", subjectId: input.assessmentId, actorId: input.actorId, action: "EXCEPTION_RECORDED", details: { blockerIds: input.blockerIds, reason: input.reason } });
    });
    return this.closure(input.tenantId, input.projectId);
  }

  /** Checks the stored assessment against the live records: every live blocker must be on it and carry a reason. */
  private async verifyCovered(tx: SqlTransaction, tenantId: string, projectId: string, assessmentId: string) {
    const live = await this.liveBlockers(tx, tenantId, projectId);
    const stored = await this.blockers(tx, assessmentId);
    const byKey = new Map(stored.map((b) => [key(b), b]));
    const changed = live.filter((b) => !byKey.has(key(b)));
    if (changed.length) throw new ClaimsClosureError("CONFLICT", "The project changed since the closure check. Run the check again.");
    const missing = live.filter((b) => !byKey.get(key(b))?.exceptionReason);
    if (missing.length) throw new ClaimsClosureError("INVALID", `Write a reason for each open item before closing (${missing.length} left).`);
    return live.map((b) => byKey.get(key(b))!.id);
  }

  async submitClose(input: { tenantId: string; actorId: string; projectId: string; assessmentId: string }): Promise<ClosureState> {
    await this.client.$transaction(async (tx) => {
      const project = await this.head(tx, input.tenantId, input.projectId, true);
      this.assertOpen(project);
      await this.latestAssessment(tx, input.tenantId, input.projectId, input.assessmentId);
      const pending = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "Approval" WHERE "subject_type" = 'PROJECT' AND "subject_id" = $1 AND "action_code"::text IN ('FINAL_CLOSE', 'REOPEN') AND "decision" = 'PENDING'`, input.projectId);
      if (pending.length) throw new ClaimsClosureError("CONFLICT", "Closing is already waiting for approval.");
      const covered = await this.verifyCovered(tx, input.tenantId, input.projectId, input.assessmentId);
      const approvalId = await this.requestApproval(tx, "FINAL_CLOSE", "PROJECT", input.projectId, project.version, { assessmentId: input.assessmentId, covered }, input.actorId,
        covered.length ? `Closing with ${covered.length} accepted item(s).` : "All closure checks passed.");
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "CLOSURE", subjectId: input.assessmentId, actorId: input.actorId, action: "CLOSE_SUBMITTED", details: { approvalId, accepted: covered.length } });
    });
    return this.closure(input.tenantId, input.projectId);
  }

  async submitReopen(input: { tenantId: string; actorId: string; projectId: string; reason: string }): Promise<ClosureState> {
    await this.client.$transaction(async (tx) => {
      const project = await this.head(tx, input.tenantId, input.projectId, true);
      if (project.finalState !== "FINAL_CLOSED") throw new ClaimsClosureError("CONFLICT", "This project is not closed.");
      const pending = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "Approval" WHERE "subject_type" = 'PROJECT' AND "subject_id" = $1 AND "action_code"::text = 'REOPEN' AND "decision" = 'PENDING'`, input.projectId);
      if (pending.length) throw new ClaimsClosureError("CONFLICT", "Reopening is already waiting for approval.");
      const approvalId = await this.requestApproval(tx, "REOPEN", "PROJECT", input.projectId, project.version, { reason: input.reason }, input.actorId, input.reason);
      await this.audit(tx, { tenantId: input.tenantId, projectId: input.projectId, subjectType: "CLOSURE", subjectId: input.projectId, actorId: input.actorId, action: "REOPEN_SUBMITTED", details: { approvalId, reason: input.reason } });
    });
    return this.closure(input.tenantId, input.projectId);
  }

  // ---------------- approvals ----------------

  async approvalSubject(tenantId: string, approvalId: string): Promise<{ action: "CLAIM_OUTCOME" | "FINAL_CLOSE" | "REOPEN"; projectId: string; claimId: string | null; proposalId: string | null } | null> {
    const row = (await this.client.$queryRawUnsafe<Array<Record<string, string | null>>>(
      `SELECT ap."action_code"::text action, COALESCE(c."project_id", p."id")::text project_id, c."id"::text claim_id, pr."id"::text proposal_id
         FROM "Approval" ap
         LEFT JOIN "ClaimOutcomeProposal" pr ON ap."action_code"::text = 'CLAIM_OUTCOME' AND pr."id" = ap."subject_id"
         LEFT JOIN "Claim" c ON c."id" = pr."claim_id" AND c."tenant_id" = $2
         LEFT JOIN "Project" p ON ap."action_code"::text IN ('FINAL_CLOSE', 'REOPEN') AND ap."subject_type" = 'PROJECT' AND p."id" = ap."subject_id" AND p."tenant_id" = $2
        WHERE ap."id" = $1 AND (c."id" IS NOT NULL OR p."id" IS NOT NULL)`, approvalId, tenantId))[0];
    return row ? { action: row.action as "CLAIM_OUTCOME" | "FINAL_CLOSE" | "REOPEN", projectId: String(row.project_id), claimId: row.claim_id, proposalId: row.proposal_id } : null;
  }

  async listPendingApprovals(tenantId: string): Promise<ClaimClosureApprovalItem[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id"::text id, ap."action_code"::text action, ap."requester_id"::text requester_id, u."name_en" requester_name, ap."reason",
              COALESCE(c."project_id", p."id")::text project_id, COALESCE(cp."reference", p."reference") project_reference,
              c."id"::text claim_id, c."side", c."type"::text claim_type, COALESCE(ss."reference", sp."reference") shipment_reference, COALESCE(cu."legal_name", su."registered_name") party,
              pr."proposed_outcome"::text outcome, pr."amount"::text amount, btrim(c."currency") currency
         FROM "Approval" ap JOIN "User" u ON u."id" = ap."requester_id"
         LEFT JOIN "ClaimOutcomeProposal" pr ON ap."action_code"::text = 'CLAIM_OUTCOME' AND pr."id" = ap."subject_id"
         LEFT JOIN "Claim" c ON c."id" = pr."claim_id" AND c."tenant_id" = $1
         LEFT JOIN "Project" cp ON cp."id" = c."project_id"
         LEFT JOIN "SalesShipment" ss ON ss."id" = c."sales_shipment_id" LEFT JOIN "SupplierShipment" sp ON sp."id" = c."supplier_shipment_id"
         LEFT JOIN "Customer" cu ON cu."id" = c."customer_master_id" LEFT JOIN "Supplier" su ON su."id" = c."supplier_master_id"
         LEFT JOIN "Project" p ON ap."action_code"::text IN ('FINAL_CLOSE', 'REOPEN') AND ap."subject_type" = 'PROJECT' AND p."id" = ap."subject_id" AND p."tenant_id" = $1
        WHERE ap."decision" = 'PENDING' AND ap."action_code"::text IN ('CLAIM_OUTCOME', 'FINAL_CLOSE', 'REOPEN') AND (c."id" IS NOT NULL OR p."id" IS NOT NULL)
        ORDER BY ap."id"`, tenantId);
    return rows.map((r) => {
      const action = r.action as ClaimClosureApprovalItem["actionCode"];
      const claim = action === "CLAIM_OUTCOME";
      const detail = claim
        ? `${r.side === "CUSTOMER" ? "Customer claim by" : "Supplier claim against"} ${r.party} · ${String(r.claim_type).toLowerCase()} · ${r.outcome === "RESOLVED" ? "settle" : "reject"} — ${r.reason}`
        : String(r.reason ?? "");
      return {
        id: String(r.id), actionCode: action, subjectType: claim ? "CLAIM" : action === "FINAL_CLOSE" ? "PROJECT_CLOSE" : "PROJECT_REOPEN",
        subjectId: String(claim ? r.claim_id : r.project_id), subjectReference: String(claim ? r.shipment_reference : r.project_reference), projectId: String(r.project_id), projectReference: String(r.project_reference),
        detail, amount: claim && r.outcome === "RESOLVED" ? money(r.amount) : null, currency: claim ? str(r.currency) : null, quantity: "0",
        requesterId: String(r.requester_id), requesterName: String(r.requester_name), requestedAt: uuidV7Time(String(r.id)),
      };
    });
  }

  async decide(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null }) {
    const subject = await this.approvalSubject(input.tenantId, input.approvalId);
    if (!subject) return null;
    await this.client.$transaction(async (tx) => {
      if (subject.action === "CLAIM_OUTCOME") {
        const c = await this.lockClaim(tx, input.tenantId, String(subject.claimId));
        this.assertOpen(await this.head(tx, input.tenantId, subject.projectId));
        await this.decideApproval(tx, input.approvalId, input.approverId, input.decision, input.comment);
        if (c.state !== "UNDER_REVIEW") throw new ClaimsClosureError("CONFLICT", "This claim is no longer under review.");
        await tx.$executeRawUnsafe(`UPDATE "ClaimOutcomeProposal" SET "state" = $2::"ProposalState" WHERE "id" = $1`, subject.proposalId, input.decision === "APPROVED" ? "APPROVED" : "REJECTED");
        await this.audit(tx, { tenantId: input.tenantId, projectId: subject.projectId, subjectType: "CLAIM", subjectId: String(subject.claimId), actorId: input.approverId, action: input.decision, details: { approvalId: input.approvalId, comment: input.comment } });
        if (input.decision === "APPROVED") await this.apply(tx, input.tenantId, subject.projectId, String(subject.claimId), String(subject.proposalId), input.approverId);
        return;
      }
      const project = await this.head(tx, input.tenantId, subject.projectId, true);
      if (subject.action === "FINAL_CLOSE") {
        this.assertOpen(project);
        const facts = (await tx.$queryRawUnsafe<Array<{ assessment_id: string }>>(
          `SELECT a."id"::text assessment_id FROM "ClosureAssessment" a WHERE a."tenant_id" = $1 AND a."project_id" = $2 ORDER BY a."assessed_at" DESC, a."id" DESC LIMIT 1`, input.tenantId, subject.projectId))[0];
        await this.decideApproval(tx, input.approvalId, input.approverId, input.decision, input.comment);
        if (input.decision === "APPROVED") {
          if (!facts) throw new ClaimsClosureError("CONFLICT", "Run the closure check again.");
          const covered = await this.verifyCovered(tx, input.tenantId, subject.projectId, facts.assessment_id);
          for (const blockerId of covered) await tx.$executeRawUnsafe(`UPDATE "ClosureBlocker" SET "covered_by_approval_id" = $2 WHERE "id" = $1`, blockerId, input.approvalId);
          await tx.$executeRawUnsafe(
            `UPDATE "Project" SET "final_state" = 'FINAL_CLOSED', "closed_at" = NOW(), "closed_by" = $2, "closure_assessment_id" = $3, "version" = "version" + 1, "updated_at" = NOW() WHERE "id" = $1`,
            subject.projectId, input.approverId, facts.assessment_id);
        }
        await this.audit(tx, { tenantId: input.tenantId, projectId: subject.projectId, subjectType: "CLOSURE", subjectId: subject.projectId, actorId: input.approverId, action: input.decision === "APPROVED" ? "CLOSED" : "REJECTED", details: { approvalId: input.approvalId, comment: input.comment } });
        return;
      }
      if (project.finalState !== "FINAL_CLOSED") throw new ClaimsClosureError("CONFLICT", "This project is not closed.");
      await this.decideApproval(tx, input.approvalId, input.approverId, input.decision, input.comment);
      if (input.decision === "APPROVED") {
        const reason = (await tx.$queryRawUnsafe<Array<{ reason: string | null }>>(`SELECT "reason" FROM "Approval" WHERE "id" = $1`, input.approvalId))[0]?.reason ?? null;
        await tx.$executeRawUnsafe(
          `UPDATE "Project" SET "final_state" = 'OPEN', "reopened_at" = NOW(), "reopened_by" = $2, "reopen_reason" = $3, "version" = "version" + 1, "updated_at" = NOW() WHERE "id" = $1`,
          subject.projectId, input.approverId, reason);
      }
      await this.audit(tx, { tenantId: input.tenantId, projectId: subject.projectId, subjectType: "CLOSURE", subjectId: subject.projectId, actorId: input.approverId, action: input.decision === "APPROVED" ? "REOPENED" : "REJECTED", details: { approvalId: input.approvalId, comment: input.comment } });
    });
    return subject;
  }
}
