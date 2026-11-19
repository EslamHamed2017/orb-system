import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { approvalInbox, idempotencyKey, jsonBody, mapShipmentErrors, shipmentActor, shipmentExecution, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

export interface ApprovalDecisionPrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface ApprovalDecisionRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<ApprovalDecisionPrincipal | null>;
  readonly decide: (input: { request: NextRequest; approvalId: string; principal: ApprovalDecisionPrincipal }) => Promise<unknown>;
}
function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: `https://orb.invalid/problems/${code.toLowerCase()}`, title: code, status, detail, code },
    { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
export function createApprovalDecisionPostHandler(dependencies: ApprovalDecisionRouteDependencies) {
  return async function POST(request: NextRequest, context: { params: Promise<{ approvalId: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (principal === null) return problem(401, "UNAUTHENTICATED", "Authentication is required.");
    if (!principal.roles.includes("OWNER_ADMIN")) return problem(403, "PERMISSION_DENIED", "Owner approval access is required.");
    const { approvalId } = await context.params;
    return NextResponse.json(await dependencies.decide({ request, approvalId, principal }), { headers: { "Cache-Control": "no-store" } });
  };
}
export const POST = mapShipmentErrors(createApprovalDecisionPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  decide: async ({ request, approvalId, principal }) => approvalInbox().decide(principal as never, approvalId, await jsonBody(request), idempotencyKey(request)),
}));
