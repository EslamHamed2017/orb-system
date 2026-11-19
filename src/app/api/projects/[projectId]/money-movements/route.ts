import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, moneyService, shipmentActor, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface RecordMovementRouteDependencies { readonly authenticate: (request: Request) => Promise<Principal | null>; readonly record?: (input: { request: Request; projectId: string; principal: Principal; body: unknown }) => Promise<unknown> }
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createRecordMovementPostHandler(dependencies: RecordMovementRouteDependencies) { return async (request: Request, context: { params: Promise<{ projectId: string }> }) => { const principal = await dependencies.authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) return problem(403, "PERMISSION_DENIED"); if (!dependencies.record) return problem(503, "DEPENDENCY_UNAVAILABLE"); const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || Array.isArray(body)) return problem(422, "VALIDATION_FAILED"); const { projectId } = await context.params; return NextResponse.json(await dependencies.record({ request, projectId, principal, body }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
/** multipart/form-data: kind, counterpartyId, amount, currency, fxRate, occurredOn, reference, notes?, file (bank slip). */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const form = await request.formData().catch(() => null);
  if (!form) return problem(400, "VALIDATION_FAILED");
  const { projectId } = await context.params;
  return NextResponse.json(await moneyService().recordMovement(actor, projectId, form), { status: 201, headers: { "Cache-Control": "no-store" } });
});

/** The project's money: receipts, payments, allocations, open invoices, expenses and per-currency totals. */
export const GET = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await moneyService().projectMoney(actor, projectId), { headers: { "Cache-Control": "no-store" } });
});
