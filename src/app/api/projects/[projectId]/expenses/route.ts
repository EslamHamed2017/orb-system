import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, moneyService, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface CreateExpenseRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly create?: (input: { request: Request; projectId: string; principal: Principal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createCreateExpensePostHandler(dependencies: CreateExpenseRouteDependencies) { return async (request: Request, context: { params: Promise<{ projectId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) return problem(403, "PERMISSION_DENIED"); if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE"); const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || Array.isArray(body)) return problem(422, "VALIDATION_FAILED"); const { projectId } = await context.params; return NextResponse.json(await dependencies.create({ request, projectId, principal, body }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
/** multipart/form-data: categoryCode, supplierId | payeeName, description?, shipmentType? + shipmentId?, amount, currency, fxRate, occurredOn, file (bill). */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const form = await request.formData().catch(() => null);
  if (!form) return problem(400, "VALIDATION_FAILED");
  const { projectId } = await context.params;
  return NextResponse.json(await moneyService().createExpense(actor, projectId, form), { status: 201, headers: { "Cache-Control": "no-store" } });
});
