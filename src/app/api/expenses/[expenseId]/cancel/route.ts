import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { jsonBody, mapShipmentErrors, moneyService, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Cancels a pending or approved expense with a reason; the bill and history are kept. */
export const POST = mapShipmentErrors(async (request: Request, context: { params: Promise<{ expenseId: string }> }) => {
  const actor = await shipmentMutationActor(request);
  const { expenseId } = await context.params;
  return NextResponse.json(await moneyService().cancelExpense(actor, expenseId, await jsonBody(request)), { headers: { "Cache-Control": "no-store" } });
});
