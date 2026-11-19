import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invoiceService, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface ConfirmSupplierInvoiceRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly confirm?: (input: { request: Request; invoiceId: string; principal: Principal }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createConfirmSupplierInvoicePostHandler(dependencies: ConfirmSupplierInvoiceRouteDependencies) { return async (request: Request, context: { params: Promise<{ invoiceId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => ["OWNER_ADMIN", "FINANCE_VIEWER"].includes(role))) return problem(403, "PERMISSION_DENIED"); if (!dependencies.confirm) return problem(503, "DEPENDENCY_UNAVAILABLE"); const { invoiceId } = await context.params; return NextResponse.json(await dependencies.confirm({ request, invoiceId, principal }), { status: 200, headers: { "Cache-Control": "no-store" } }); }; }
export const POST = mapShipmentErrors(createConfirmSupplierInvoicePostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  confirm: async ({ invoiceId, principal }) => invoiceService().confirmSupplierInvoice(principal as never, invoiceId),
}));
