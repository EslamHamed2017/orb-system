import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../../../modules/access/permissions.ts";

export interface SalesShipmentLinePrincipal extends OperationPrincipal {}
interface Dependencies {
  readonly authenticate: (request: Request) => Promise<SalesShipmentLinePrincipal | null>;
  readonly list?: (input: { request: Request; shipmentId: string; datasetId: string; principal: SalesShipmentLinePrincipal }) => Promise<unknown>;
  readonly create?: (input: { request: Request; shipmentId: string; datasetId: string; principal: SalesShipmentLinePrincipal; body: unknown }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
function denied(principal: SalesShipmentLinePrincipal | null, operationId: string) {
  if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
  try { assertServerPermission(principal, operationId); return null; } catch { return problem(403, "PERMISSION_DENIED"); }
}
export function createGetHandler(dependencies: Dependencies) { return async (request: Request, context: { params: Promise<{ shipmentId: string; datasetId: string }> }) => { const principal = await dependencies.authenticate(request), rejection = denied(principal, "listSalesShipmentLines"); if (rejection) return rejection; if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE"); const ids = await context.params; return NextResponse.json({ items: await dependencies.list({ request, ...ids, principal: principal! }) }, { headers: { "Cache-Control": "no-store" } }); }; }
export function createPostHandler(dependencies: Dependencies) { return async (request: Request, context: { params: Promise<{ shipmentId: string; datasetId: string }> }) => { const principal = await dependencies.authenticate(request), rejection = denied(principal, "createSalesShipmentLine"); if (rejection) return rejection; if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE"); const ids = await context.params; return NextResponse.json(await dependencies.create({ request, ...ids, principal: principal!, body: await request.json() }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
const unavailable: Dependencies = { authenticate: async () => null };
export const GET = createGetHandler(unavailable);
export const POST = createPostHandler(unavailable);
