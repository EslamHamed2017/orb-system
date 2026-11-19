import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { approvalInbox, idempotencyKey, jsonBody, mapShipmentErrors, shipmentActor, shipmentExecution, shipmentMutationActor } from "../../../modules/shipments/execution/shipment-execution-runtime.ts";

export interface ApprovalInboxPrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface ApprovalInboxRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<ApprovalInboxPrincipal | null>;
  readonly list: (input: { request: NextRequest; principal: ApprovalInboxPrincipal }) => Promise<unknown>;
}
function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: `https://orb.invalid/problems/${code.toLowerCase()}`, title: code, status, detail, code },
    { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
export function createApprovalsGetHandler(dependencies: ApprovalInboxRouteDependencies) {
  return async function GET(request: NextRequest) {
    const principal = await dependencies.authenticate(request);
    if (principal === null) return problem(401, "UNAUTHENTICATED", "Authentication is required.");
    if (!principal.roles.includes("OWNER_ADMIN")) return problem(403, "PERMISSION_DENIED", "Owner approval access is required.");
    return NextResponse.json(await dependencies.list({ request, principal }), { headers: { "Cache-Control": "no-store" } });
  };
}
export const GET = mapShipmentErrors(createApprovalsGetHandler({
  authenticate: (request) => shipmentActor(request),
  list: async ({ principal }) => approvalInbox().list(principal as never),
}));
