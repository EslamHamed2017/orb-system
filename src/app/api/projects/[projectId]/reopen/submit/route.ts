import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Asks another owner to approve reopening the project, with a reason. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().submitReopen(actor, projectId, await jsonBody(request)), { status: 202, headers: { "Cache-Control": "no-store" } });
});
