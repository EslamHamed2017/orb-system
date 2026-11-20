import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, mapShipmentErrors, shipmentActor, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** The project's claims and the shipments a claim can be raised on. */
export const GET = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().projectClaims(actor, projectId), { headers: { "Cache-Control": "no-store" } });
});

/** multipart/form-data: shipmentId, type, description, quantity?, amount?, currency?, file (evidence). */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ title: "VALIDATION_FAILED", status: 422, code: "VALIDATION_FAILED", detail: "Send the claim as a form with the evidence file." }, { status: 422, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().openClaim(actor, projectId, form), { status: 201, headers: { "Cache-Control": "no-store" } });
});
