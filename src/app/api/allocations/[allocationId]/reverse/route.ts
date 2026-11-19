import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { bodyOf, mapShipmentErrors, moneyService, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface ReverseAllocationRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly reverse?: (input: { request: Request; allocationId: string; principal: Principal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createReverseAllocationPostHandler(dependencies: ReverseAllocationRouteDependencies) { return async (request: Request, context: { params: Promise<{ allocationId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) return problem(403, "PERMISSION_DENIED"); if (!dependencies.reverse) return problem(503, "DEPENDENCY_UNAVAILABLE"); const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || Array.isArray(body)) return problem(422, "VALIDATION_FAILED"); const { allocationId } = await context.params; return NextResponse.json(await dependencies.reverse({ request, allocationId, principal, body }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
export const POST = mapShipmentErrors(createReverseAllocationPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  reverse: ({ request, allocationId, principal, body }) => moneyService().reverseAllocation(principal as never, allocationId, bodyOf(request, body)),
}) as never);
