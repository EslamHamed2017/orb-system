import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { invoiceService, jsonBody, mapShipmentErrors, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Cancel an issued customer invoice with a reason (refused while collections are allocated to it). */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ invoiceId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { invoiceId } = await context.params;
  return NextResponse.json(await invoiceService().cancelSalesInvoice(actor, invoiceId, await jsonBody(request)), { headers: { "Cache-Control": "no-store" } });
});
