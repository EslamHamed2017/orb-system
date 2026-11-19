import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invoiceService, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessProblemResponse } from "../../../../../modules/access/access-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";
interface Principal extends OperationPrincipal {}
export interface CreateSupplierInvoiceRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly create?: (input: { request: Request; shipmentId: string; principal: Principal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createCreateSupplierInvoicePostHandler(dependencies: CreateSupplierInvoiceRouteDependencies) { return async (request: Request, context: { params: Promise<{ shipmentId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); try { assertServerPermission(principal, "createSupplierInvoice"); } catch { return problem(403, "PERMISSION_DENIED"); } if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE"); const { shipmentId } = await context.params; return NextResponse.json(await dependencies.create({ request, shipmentId, principal, body: await request.json() }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
/** multipart/form-data: file (PDF/JPG/PNG, max 10 MB), reference, invoiceDate, amount. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ shipmentId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const form = await request.formData().catch(() => null);
  if (!form) return accessProblemResponse(400, "VALIDATION_FAILED", "Send the invoice as multipart/form-data.");
  const { shipmentId } = await context.params;
  return NextResponse.json(await invoiceService().createSupplierInvoice(actor, shipmentId, form), { status: 201, headers: { "Cache-Control": "no-store" } });
});
