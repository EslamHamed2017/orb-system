import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, shipmentActor } from "../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { companyDocumentProfile } from "../../../../modules/invoices/invoice-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../../../platform/database/prisma-client.ts";

/** The company details every printed document carries (read-only; any signed-in user of the company). */
export const GET = mapShipmentErrors(async (request: Request) => {
  const actor = await shipmentActor(request);
  return NextResponse.json(await companyDocumentProfile(getPrismaClient() as never, actor.tenantId), { headers: { "Cache-Control": "no-store" } });
});
