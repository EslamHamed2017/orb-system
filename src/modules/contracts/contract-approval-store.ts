import { createHash } from "node:crypto";
import type { SqlClient } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { uuidV7Time } from "../shipments/execution/shipment-kinds.ts";

/**
 * Contract approval on PostgreSQL: a draft contract version is submitted, and a different
 * owner approves it (contract + version become APPROVED) or rejects it (back to DRAFT).
 * Shipments can only be created against an approved contract version.
 */

export class ContractApprovalError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID";
  constructor(code: ContractApprovalError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface ContractApprovalState {
  readonly contractId: string;
  readonly reference: string;
  readonly kind: "SALES" | "PURCHASE";
  readonly projectId: string;
  readonly state: string;
  readonly versionId: string;
  readonly versionState: string;
  readonly pendingApproval: { readonly id: string; readonly requesterId: string; readonly requesterName: string; readonly requestedAt: string | null } | null;
  readonly lastDecision: { readonly decision: string; readonly comment: string | null; readonly approverName: string | null; readonly decidedAt: string | null } | null;
}

export interface ContractInboxItem {
  readonly id: string;
  readonly actionCode: "CONTRACT_VERSION";
  readonly subjectType: "CONTRACT";
  readonly subjectId: string;
  readonly subjectReference: string;
  readonly contractKind: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly quantity: string;
  readonly requesterId: string;
  readonly requesterName: string;
  readonly requestedAt: string | null;
}

export class PrismaContractApprovalStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async state(tenantId: string, contractId: string): Promise<ContractApprovalState> {
    const row = (await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c."id", c."reference", c."kind"::text kind, c."project_id", c."state"::text state, v."id" version_id, v."state"::text version_state
         FROM "Contract" c JOIN "ContractVersion" v ON v."id" = c."active_version_id"
        WHERE c."tenant_id" = $1 AND c."id" = $2`, tenantId, contractId))[0];
    if (!row) throw new ContractApprovalError("NOT_FOUND", "Contract not found");
    const approvals = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."decision"::text decision, ap."requester_id", ru."name_en" requester_name, au."name_en" approver_name, ap."decided_at", ap."comment"
         FROM "Approval" ap JOIN "User" ru ON ru."id" = ap."requester_id" LEFT JOIN "User" au ON au."id" = ap."approver_id"
        WHERE ap."action_code" = 'CONTRACT_VERSION' AND ap."subject_type" = 'CONTRACT' AND ap."subject_id" = $1 ORDER BY ap."id" DESC`, contractId);
    const pending = approvals.find((a) => a.decision === "PENDING");
    const decided = approvals.find((a) => a.decision === "APPROVED" || a.decision === "REJECTED");
    return {
      contractId: String(row.id), reference: String(row.reference), kind: row.kind as "SALES" | "PURCHASE", projectId: String(row.project_id),
      state: String(row.state), versionId: String(row.version_id), versionState: String(row.version_state),
      pendingApproval: pending ? { id: String(pending.id), requesterId: String(pending.requester_id), requesterName: String(pending.requester_name), requestedAt: uuidV7Time(String(pending.id)) } : null,
      lastDecision: decided ? { decision: String(decided.decision), comment: decided.comment === null ? null : String(decided.comment), approverName: decided.approver_name === null ? null : String(decided.approver_name), decidedAt: decided.decided_at ? new Date(decided.decided_at as string).toISOString() : null } : null,
    };
  }

  async submit(input: { tenantId: string; contractId: string; actorId: string }): Promise<ContractApprovalState> {
    await this.client.$transaction(async (tx) => {
      const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT c."version", c."state"::text state, v."id" version_id, v."state"::text version_state, row_to_json(v)::text version_json, p."lifecycle_state"::text project_state
           FROM "Contract" c JOIN "ContractVersion" v ON v."id" = c."active_version_id" JOIN "Project" p ON p."id" = c."project_id"
          WHERE c."tenant_id" = $1 AND c."id" = $2 FOR UPDATE OF c, v`, input.tenantId, input.contractId))[0];
      if (!row) throw new ContractApprovalError("NOT_FOUND", "Contract not found");
      if (row.version_state !== "DRAFT") {
        throw new ContractApprovalError("CONFLICT", row.version_state === "PENDING_APPROVAL" ? "This contract is already waiting for approval." : "Only a draft contract version can be submitted.");
      }
      if (row.project_state === "CANCELLED") throw new ContractApprovalError("CONFLICT", "The project is cancelled.");
      const hash = createHash("sha256").update(String(row.version_json)).digest("hex");
      const approvalId = (await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "Approval" ("action_code","subject_type","subject_id","subject_version","subject_hash","requester_id","decision")
         VALUES ('CONTRACT_VERSION','CONTRACT',$1,$2,$3,$4,'PENDING') RETURNING "id"::text id`,
        input.contractId, Number(row.version), hash, input.actorId))[0].id;
      await tx.$executeRawUnsafe(`UPDATE "ContractVersion" SET "state" = 'PENDING_APPROVAL', "approval_id" = $1 WHERE "id" = $2`, approvalId, row.version_id);
      await tx.$executeRawUnsafe(`UPDATE "Contract" SET "state" = 'PENDING_APPROVAL', "version" = "version" + 1 WHERE "id" = $1`, input.contractId);
    });
    return this.state(input.tenantId, input.contractId);
  }

  async approvalSubject(tenantId: string, approvalId: string): Promise<{ contractId: string } | null> {
    const row = (await this.client.$queryRawUnsafe<Array<{ subject_id: string }>>(
      `SELECT ap."subject_id"::text subject_id FROM "Approval" ap JOIN "Contract" c ON c."id" = ap."subject_id" AND c."tenant_id" = $2
        WHERE ap."id" = $1 AND ap."action_code" = 'CONTRACT_VERSION'`, approvalId, tenantId))[0];
    return row ? { contractId: row.subject_id } : null;
  }

  async decide(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null }): Promise<ContractApprovalState> {
    const subject = await this.approvalSubject(input.tenantId, input.approvalId);
    if (!subject) throw new ContractApprovalError("NOT_FOUND", "Approval not found");
    await this.client.$transaction(async (tx) => {
      const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT v."id" version_id, v."approval_id", ap."decision"::text decision, ap."requester_id"
           FROM "Contract" c JOIN "ContractVersion" v ON v."id" = c."active_version_id" JOIN "Approval" ap ON ap."id" = $3
          WHERE c."tenant_id" = $1 AND c."id" = $2 FOR UPDATE OF c, v, ap`, input.tenantId, subject.contractId, input.approvalId))[0];
      if (!row || row.decision !== "PENDING") throw new ContractApprovalError("CONFLICT", "This approval was already decided.");
      if (row.requester_id === input.approverId) throw new ContractApprovalError("INVALID", "You cannot approve your own request.");
      if (row.approval_id !== input.approvalId) throw new ContractApprovalError("CONFLICT", "The contract changed after it was submitted. It must be submitted again.");
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = $2::"ApprovalDecision", "approver_id" = $3, "decided_at" = NOW(), "comment" = $4 WHERE "id" = $1`,
        input.approvalId, input.decision, input.approverId, input.comment);
      const next = input.decision === "APPROVED" ? "APPROVED" : "DRAFT";
      await tx.$executeRawUnsafe(`UPDATE "ContractVersion" SET "state" = $2::"ContractVersionState"${next === "DRAFT" ? `, "approval_id" = NULL` : ""} WHERE "id" = $1`, row.version_id, next);
      await tx.$executeRawUnsafe(`UPDATE "Contract" SET "state" = $2, "version" = "version" + 1 WHERE "id" = $1`, subject.contractId, next);
    });
    return this.state(input.tenantId, subject.contractId);
  }

  async listPending(tenantId: string): Promise<ContractInboxItem[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."id", ap."subject_id", ap."requester_id", u."name_en" requester_name, c."reference", c."kind"::text kind, c."project_id", p."reference" project_reference, v."quantity"::text quantity
         FROM "Approval" ap
         JOIN "Contract" c ON c."id" = ap."subject_id" AND c."tenant_id" = $1
         JOIN "ContractVersion" v ON v."id" = c."active_version_id"
         JOIN "Project" p ON p."id" = c."project_id"
         JOIN "User" u ON u."id" = ap."requester_id"
        WHERE ap."action_code" = 'CONTRACT_VERSION' AND ap."decision" = 'PENDING' ORDER BY ap."id"`, tenantId);
    return rows.map((r) => ({
      id: String(r.id), actionCode: "CONTRACT_VERSION", subjectType: "CONTRACT", subjectId: String(r.subject_id), subjectReference: String(r.reference), contractKind: String(r.kind),
      projectId: String(r.project_id), projectReference: String(r.project_reference), quantity: Number(r.quantity).toFixed(6),
      requesterId: String(r.requester_id), requesterName: String(r.requester_name), requestedAt: uuidV7Time(String(r.id)),
    }));
  }
}
