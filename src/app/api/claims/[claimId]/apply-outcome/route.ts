import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Applies an approved outcome (approval already applies it; this is idempotent). */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ claimId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { claimId } = await context.params;
  return NextResponse.json(await claimsClosureService().applyOutcome(actor, claimId), { headers: { "Cache-Control": "no-store" } });
});
