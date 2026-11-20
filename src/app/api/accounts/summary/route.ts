import { NextResponse } from "next/server.js";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface AccountsSummaryRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly summary?: (input: { request: Request; principal: Principal; projectId?: string }) => Promise<unknown>;
}
const ROLES = new Set(["OWNER_ADMIN", "FINANCE_VIEWER"]);
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createAccountsSummaryGetHandler(dependencies: AccountsSummaryRouteDependencies) {
  return async function GET(request: Request) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ROLES.has(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.summary) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return NextResponse.json(await dependencies.summary({ request, principal, ...(projectId ? { projectId } : {}) }), { headers: { "Cache-Control": "no-store" } });
  };
}
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accountsService, mapShipmentErrors, shipmentActor } from "../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Company-scoped accounts totals per currency, optionally for one project (Owner and Finance). */
export const GET = mapShipmentErrors(createAccountsSummaryGetHandler({
  authenticate: (request) => shipmentActor(request) as never,
  summary: ({ principal, projectId }) => accountsService().summary(principal as never, projectId),
}) as never);
