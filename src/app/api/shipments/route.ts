import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, profitService, shipmentActor } from "../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** All supplier and customer shipments of the company, newest first, with what is waiting on each (no prices). */
export const GET = mapShipmentErrors(async (request: Request) => {
  const actor = await shipmentActor(request);
  return NextResponse.json(await profitService().shipmentQueue(actor), { headers: { "Cache-Control": "no-store" } });
});
