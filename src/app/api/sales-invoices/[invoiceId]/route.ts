import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invoiceService, mapShipmentErrors, shipmentActor } from "../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../modules/access/permissions.ts";
export interface SalesInvoicePrincipal extends OperationPrincipal {}
export interface Dependencies { authenticate: (request: Request) => Promise<SalesInvoicePrincipal | null>; get?: (input: { request: Request; invoiceId: string; principal: SalesInvoicePrincipal }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control":"no-store" } }); }
export function createGetHandler(dependencies: Dependencies) { return async (request: Request, context: { params: Promise<{ invoiceId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401,"AUTHENTICATION_REQUIRED"); try { assertServerPermission(principal, "getSalesInvoice"); } catch { return problem(403, "PERMISSION_DENIED"); } if (!dependencies.get) return problem(503,"DEPENDENCY_UNAVAILABLE"); const { invoiceId } = await context.params; return NextResponse.json(await dependencies.get({ request, invoiceId, principal }), { headers: { "Cache-Control":"no-store" } }); }; }
export const GET = mapShipmentErrors(createGetHandler({
  authenticate: (request) => shipmentActor(request),
  get: async ({ invoiceId, principal }) => invoiceService().getSalesInvoice(principal as never, invoiceId),
}));
