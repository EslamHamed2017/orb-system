import type { RouteChecklist, RouteService } from "./route-service.ts";

export interface RouteChecklistQuery { readonly getByShipmentId: (shipmentId: string) => Promise<RouteChecklist> }
export function createRouteChecklistQuery(service: Pick<RouteService, "getChecklist">): RouteChecklistQuery {
  return Object.freeze({ getByShipmentId: (shipmentId: string) => service.getChecklist(shipmentId) });
}
