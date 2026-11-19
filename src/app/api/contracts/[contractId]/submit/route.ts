import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { approvalInbox, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface SubmitContractRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly submit?: (input: { request: Request; contractId: string; principal: Principal }) => Promise<unknown> }
export function createSubmitContractPostHandler(dependencies: SubmitContractRouteDependencies) { return async (request: Request, context: { params: Promise<{ contractId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 }); if (!principal.roles.some((role) => ["OWNER_ADMIN", "OPERATIONS"].includes(role))) return NextResponse.json({ code: "PERMISSION_DENIED" }, { status: 403 }); if (!dependencies.submit) return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503 }); const { contractId } = await context.params; return NextResponse.json(await dependencies.submit({ request, contractId, principal }), { status: 202 }); }; }
export const POST = mapShipmentErrors(createSubmitContractPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  submit: async ({ contractId, principal }) => approvalInbox().submitContract(principal as never, contractId),
}));
