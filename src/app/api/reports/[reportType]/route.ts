import { NextResponse } from "next/server.js";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
type ReportType = "CONTRACT_FULFILLMENT" | "ACCOUNTS" | "PROJECT_PROFITABILITY";
export interface OperationalReportRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly run?: (input: { request: Request; principal: Principal; reportType: ReportType; projectId?: string; from?: string; to?: string }) => Promise<unknown>;
}
const ROLES = new Set(["OWNER_ADMIN", "FINANCE_VIEWER"]);
const REPORT_TYPES: Readonly<Record<string, ReportType>> = Object.freeze({ "contract-fulfillment": "CONTRACT_FULFILLMENT", accounts: "ACCOUNTS", "project-profitability": "PROJECT_PROFITABILITY" });
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createOperationalReportGetHandler(dependencies: OperationalReportRouteDependencies) {
  return async function GET(request: Request, context: { params: Promise<{ reportType: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ROLES.has(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.run) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const reportType = REPORT_TYPES[(await context.params).reportType];
    if (!reportType) return problem(400, "VALIDATION_FAILED");
    const query = new URL(request.url).searchParams;
    const projectId = query.get("projectId") ?? undefined, from = query.get("from") ?? undefined, to = query.get("to") ?? undefined;
    return NextResponse.json(await dependencies.run({ request, principal, reportType, ...(projectId ? { projectId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }), { headers: { "Cache-Control": "no-store" } });
  };
}
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accountsService, mapShipmentErrors, profitService, shipmentActor } from "../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem } from "../../../../modules/shipments/execution/shipment-execution-service.ts";

/** Project profitability and accounts run on the database; contract fulfillment is not wired yet. */
export const GET = mapShipmentErrors(createOperationalReportGetHandler({
  authenticate: (request) => shipmentActor(request) as never,
  run: async ({ principal, reportType, projectId, from, to }) => {
    if (reportType === "PROJECT_PROFITABILITY") return profitService().profitabilityReport(principal as never, projectId);
    if (reportType === "ACCOUNTS") return accountsService().report(principal as never, { projectId, from, to });
    throw new ShipmentProblem(503, "DEPENDENCY_UNAVAILABLE", "This report is not available yet.");
  },
}) as never);
