import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { bodyOf, mapShipmentErrors, moneyService, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface AllocateMovementRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly allocate?: (input: { request: Request; movementId: string; principal: Principal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createAllocateMovementPostHandler(dependencies: AllocateMovementRouteDependencies) { return async (request: Request, context: { params: Promise<{ movementId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) return problem(403, "PERMISSION_DENIED"); if (!dependencies.allocate) return problem(503, "DEPENDENCY_UNAVAILABLE"); const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || Array.isArray(body)) return problem(422, "VALIDATION_FAILED"); const { movementId } = await context.params; return NextResponse.json(await dependencies.allocate({ request, movementId, principal, body }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
export const POST = mapShipmentErrors(createAllocateMovementPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  allocate: ({ request, movementId, principal, body }) => moneyService().allocate(principal as never, movementId, bodyOf(request, body)),
}) as never);
