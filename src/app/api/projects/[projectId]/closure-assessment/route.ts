import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { claimsClosureService, mapShipmentErrors, shipmentActor, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** The project's closure state, latest check and pending close / reopen. */
export const GET = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().closure(actor, projectId), { headers: { "Cache-Control": "no-store" } });
});

/** Runs the closure check on the live records. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { projectId } = await context.params;
  return NextResponse.json(await claimsClosureService().assess(actor, projectId), { status: 201, headers: { "Cache-Control": "no-store" } });
});
