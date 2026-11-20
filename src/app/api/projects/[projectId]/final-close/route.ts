import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Reports the closed project once an owner approved closing. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().finalClose(actor, projectId, await jsonBody(request)), { headers: { "Cache-Control": "no-store" } });
});
