import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, shipmentActor } from "../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem } from "../../../modules/shipments/execution/shipment-execution-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { listActivity } from "../../../modules/audit/activity-log.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../../platform/database/prisma-client.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Gear > Tools > Audit log: who did what across the company (owner only, read-only). */
export const GET = mapShipmentErrors(async (request: Request) => {
  const actor = await shipmentActor(request);
  if (!actor.roles.includes("OWNER_ADMIN")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "The audit log is for the owner.");
  const q = new URL(request.url).searchParams;
  const projectId = q.get("projectId"), from = q.get("from"), to = q.get("to"), limit = q.get("limit");
  if ((projectId && !UUID.test(projectId)) || (from && !DAY.test(from)) || (to && !DAY.test(to)) || (limit && !/^\d{1,3}$/.test(limit))) throw new ShipmentProblem(422, "VALIDATION_FAILED", "Check the filters.");
  return NextResponse.json(await listActivity(getPrismaClient() as never, { tenantId: actor.tenantId, projectId, from, to, limit: limit ? Number(limit) : 200 }), { headers: { "Cache-Control": "no-store" } });
});
