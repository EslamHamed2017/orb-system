import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Accepts open closure items with a written reason. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().recordExceptions(actor, projectId, await jsonBody(request)), { headers: { "Cache-Control": "no-store" } });
});
