import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Moves an open claim to review. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ claimId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { claimId } = await context.params;
  return NextResponse.json(await claimsClosureService().startReview(actor, claimId, await jsonBody(request)), { headers: { "Cache-Control": "no-store" } });
});
