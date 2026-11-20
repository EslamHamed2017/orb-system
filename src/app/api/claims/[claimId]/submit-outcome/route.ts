import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Proposes the outcome (settled with an amount, or rejected / withdrawn) for another owner to approve. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ claimId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { claimId } = await context.params;
  return NextResponse.json(await claimsClosureService().submitOutcome(actor, claimId, await jsonBody(request)), { status: 202, headers: { "Cache-Control": "no-store" } });
});
