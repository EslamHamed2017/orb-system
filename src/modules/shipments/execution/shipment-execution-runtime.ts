// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessProblemResponse, assertSessionMutation, authenticateRequest } from "../../access/access-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { AccessProblem } from "../../access/access-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaShipmentExecutionStore, type SqlClient } from "./shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, createShipmentExecutionService, type ShipmentActor, type ShipmentExecutionService } from "./shipment-execution-service.ts";

// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaContractApprovalStore } from "../../contracts/contract-approval-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createApprovalInboxService, type ApprovalInboxService } from "../../approvals/approval-inbox-service.ts";

let service: ShipmentExecutionService | undefined;
let inbox: ApprovalInboxService | undefined;

export function shipmentExecution(): ShipmentExecutionService {
  service ??= createShipmentExecutionService(new PrismaShipmentExecutionStore(getPrismaClient() as unknown as SqlClient));
  return service;
}

export function approvalInbox(): ApprovalInboxService {
  inbox ??= createApprovalInboxService(shipmentExecution(), new PrismaContractApprovalStore(getPrismaClient() as unknown as SqlClient));
  return inbox;
}

/** The signed-in actor, or a 401 problem. */
export async function shipmentActor(request: Request): Promise<ShipmentActor> {
  const actor = await authenticateRequest(request);
  if (!actor) throw new ShipmentProblem(401, "AUTHENTICATION_REQUIRED", "Sign in is required.");
  return actor;
}

/** For state-changing requests: session actor + same-origin + CSRF token. */
export async function shipmentMutationActor(request: Request): Promise<ShipmentActor> {
  const actor = await shipmentActor(request);
  assertSessionMutation(request);
  return actor;
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ShipmentProblem(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  const ifMatch = request.headers.get("if-match");
  return ifMatch && body.expectedVersion === undefined ? { ...body, expectedVersion: ifMatch } : body;
}

/** For route factories that already parsed the body: validates it and folds in an If-Match version. */
export function bodyOf(request: Request, body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ShipmentProblem(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  const record = body as Record<string, unknown>;
  const ifMatch = request.headers.get("if-match");
  return ifMatch && record.expectedVersion === undefined ? { ...record, expectedVersion: ifMatch } : record;
}

export function idempotencyKey(request: Request): string {
  return request.headers.get("idempotency-key") ?? "";
}

/** Maps ShipmentProblem / AccessProblem thrown inside a route into an RFC 9457 problem response. */
export function mapShipmentErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ShipmentProblem || error instanceof AccessProblem) return accessProblemResponse(error.status, error.code, error.detail);
      if ((error as { code?: string })?.code === "DEPENDENCY_UNAVAILABLE") return accessProblemResponse(503, "DEPENDENCY_UNAVAILABLE");
      console.error("shipment route failed", error instanceof Error ? error.message : "unknown");
      return accessProblemResponse(500, "INTERNAL_ERROR");
    }
  };
}
