import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { bodyOf, invoiceService, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";
export interface SalesInvoicePrincipal extends OperationPrincipal {}
export interface Dependencies { authenticate: (request: Request) => Promise<SalesInvoicePrincipal | null>; create?: (input: { request: Request; shipmentId: string; principal: SalesInvoicePrincipal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createPostHandler(dependencies: Dependencies) { return async (request: Request, context: { params: Promise<{ shipmentId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); try { assertServerPermission(principal, "createSalesInvoice"); } catch { return problem(403, "PERMISSION_DENIED"); } if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE"); const { shipmentId } = await context.params; return NextResponse.json(await dependencies.create({ request, shipmentId, principal, body: await request.json() }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
export const POST = mapShipmentErrors(createPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  create: async ({ request, shipmentId, principal, body }) => invoiceService().issueSalesInvoice(principal as never, shipmentId, bodyOf(request, body)),
}));
