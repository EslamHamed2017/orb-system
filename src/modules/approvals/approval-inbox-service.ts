// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ContractApprovalError, type ContractInboxItem, type PrismaContractApprovalStore } from "../contracts/contract-approval-store.ts";
import type { ApprovalInboxItem } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor, type ShipmentExecutionService } from "../shipments/execution/shipment-execution-service.ts";

type ContractStore = Pick<PrismaContractApprovalStore, keyof PrismaContractApprovalStore>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function translate(error: unknown): never {
  if (error instanceof ContractApprovalError) {
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    if (error.code === "INVALID") throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
    throw new ShipmentProblem(409, "STATE_CONFLICT", error.message);
  }
  throw error;
}

/** One owner inbox for every approval kind wired so far: contract versions and shipment confirmations. */
export function createApprovalInboxService(shipments: ShipmentExecutionService, contracts: ContractStore) {
  return Object.freeze({
    async list(actor: ShipmentActor): Promise<{ items: (ApprovalInboxItem | ContractInboxItem)[] }> {
      const shipmentItems = (await shipments.listApprovals(actor)).items;
      const contractItems = await contracts.listPending(actor.tenantId);
      return { items: [...contractItems, ...shipmentItems].sort((a, b) => a.id.localeCompare(b.id)) };
    },

    async decide(actor: ShipmentActor, approvalId: unknown, body: Record<string, unknown>, idempotencyKey: string) {
      if (!actor.roles.includes("OWNER_ADMIN")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Only an owner can decide approvals.");
      if (typeof approvalId !== "string" || !UUID.test(approvalId)) throw new ShipmentProblem(422, "VALIDATION_FAILED", "Approval is not a valid id.");
      if (await contracts.approvalSubject(actor.tenantId, approvalId)) {
        const decision = body.decision;
        if (decision !== "APPROVED" && decision !== "REJECTED") throw new ShipmentProblem(422, "VALIDATION_FAILED", "decision must be APPROVED or REJECTED.");
        const comment = typeof body.comment === "string" && body.comment.trim() ? body.comment.trim().slice(0, 500) : null;
        if (decision === "REJECTED" && (!comment || comment.length < 3)) throw new ShipmentProblem(422, "VALIDATION_FAILED", "Rejection reason must be 3-500 characters.");
        try {
          return { subjectType: "CONTRACT", contract: await contracts.decide({ tenantId: actor.tenantId, approvalId, approverId: actor.userId, decision, comment }) };
        } catch (error) { translate(error); }
      }
      return { subjectType: "SHIPMENT", shipment: await shipments.decide(actor, approvalId, body, idempotencyKey) };
    },

    async submitContract(actor: ShipmentActor, contractId: unknown) {
      if (!actor.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot submit contracts.");
      if (typeof contractId !== "string" || !UUID.test(contractId)) throw new ShipmentProblem(422, "VALIDATION_FAILED", "Contract is not a valid id.");
      try { return await contracts.submit({ tenantId: actor.tenantId, contractId, actorId: actor.userId }); } catch (error) { translate(error); }
    },
  });
}

export type ApprovalInboxService = ReturnType<typeof createApprovalInboxService>;
