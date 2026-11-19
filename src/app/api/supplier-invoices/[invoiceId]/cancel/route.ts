import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invoiceService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface CancelSupplierInvoiceRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly cancel?: (input: { request: Request; invoiceId: string; principal: Principal }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createCancelSupplierInvoicePostHandler(dependencies: CancelSupplierInvoiceRouteDependencies) { return async (request: Request, context: { params: Promise<{ invoiceId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => ["OWNER_ADMIN", "FINANCE_VIEWER"].includes(role))) return problem(403, "PERMISSION_DENIED"); if (!dependencies.cancel) return problem(503, "DEPENDENCY_UNAVAILABLE"); const { invoiceId } = await context.params; return NextResponse.json(await dependencies.cancel({ request, invoiceId, principal }), { status: 200, headers: { "Cache-Control": "no-store" } }); }; }
export const POST = mapShipmentErrors(createCancelSupplierInvoicePostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  cancel: async ({ request, invoiceId, principal }) => invoiceService().cancelSupplierInvoice(principal as never, invoiceId, await jsonBody(request)),
}));
