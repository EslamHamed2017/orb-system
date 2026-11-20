import { NextRequest, NextResponse } from "next/server.js";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface ProfitRouteDependencies { readonly authenticate: (request: NextRequest) => Promise<Principal | null>; readonly get: (input: { request: NextRequest; principal: Principal; projectId: string }) => Promise<unknown> }
const ROLES = new Set(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createProfitGetHandler(dependencies: ProfitRouteDependencies) { return async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => ROLES.has(role))) return problem(403, "PERMISSION_DENIED"); const { projectId } = await context.params; return NextResponse.json(await dependencies.get({ request, principal, projectId }), { headers: { "Cache-Control": "no-store" } }); }; }
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, profitService, shipmentActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Expected, shipped, actual and cash margin of the project with formulas and source documents (Owner and Finance). */
export const GET = mapShipmentErrors(createProfitGetHandler({
  authenticate: (request) => shipmentActor(request) as never,
  get: ({ principal, projectId }) => profitService().projectProfit(principal as never, projectId),
}) as never);
