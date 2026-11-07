export type TradeRoute = "FOREIGN_TO_FOREIGN" | "UAE_FREE_ZONE_REEXPORT" | "UAE_IMPORT";
export type RouteItemKind = "FACT" | "EVIDENCE" | "MILESTONE";
export interface RouteTemplateItem { readonly code: string; readonly label: string; readonly kind: RouteItemKind; readonly required: true; readonly applicabilityRule: "STORAGE_HANDLING_USED" | null }
export interface RouteTemplate { readonly route: TradeRoute; readonly version: 1; readonly items: readonly RouteTemplateItem[] }

const item = (code: string, label: string, kind: RouteItemKind, applicabilityRule: "STORAGE_HANDLING_USED" | null = null): RouteTemplateItem =>
  Object.freeze({ code, label, kind, required: true, applicabilityRule });
const template = (route: TradeRoute, items: readonly RouteTemplateItem[]): RouteTemplate =>
  Object.freeze({ route, version: 1, items: Object.freeze([...items]) });

export const FIXED_ROUTE_TEMPLATES: Readonly<Record<TradeRoute, RouteTemplate>> = Object.freeze({
  FOREIGN_TO_FOREIGN: template("FOREIGN_TO_FOREIGN", [
    item("ORIGIN_AND_DESTINATION", "Origin and destination", "FACT"),
    item("TRANSPORT_REFERENCE", "Transport reference", "FACT"),
    item("ORIGIN_EXPORT_EVIDENCE", "Origin/export evidence", "EVIDENCE"),
    item("DEPARTURE", "Departure", "MILESTONE"),
    item("ARRIVAL", "Arrival", "MILESTONE"),
    item("DELIVERY", "Delivery", "MILESTONE"),
  ]),
  UAE_FREE_ZONE_REEXPORT: template("UAE_FREE_ZONE_REEXPORT", [
    item("FREE_ZONE_ENTRY", "Free-zone entry evidence", "EVIDENCE"),
    item("STORAGE_HANDLING", "Storage and handling evidence", "EVIDENCE", "STORAGE_HANDLING_USED"),
    item("REEXPORT_CUSTOMS", "Exit/re-export customs evidence", "EVIDENCE"),
    item("OUTBOUND_TRANSPORT", "Outbound transport", "EVIDENCE"),
    item("DELIVERY", "Delivery", "MILESTONE"),
  ]),
  UAE_IMPORT: template("UAE_IMPORT", [
    item("UAE_IMPORT_DECLARATION", "UAE import declaration", "EVIDENCE"),
    item("CUSTOMS_CLEARANCE_AND_CHARGES", "Customs clearance and assessed charges", "EVIDENCE"),
    item("INBOUND_TRANSPORT", "Inbound transport", "EVIDENCE"),
    item("RELEASE", "Release", "MILESTONE"),
    item("DELIVERY", "Delivery", "MILESTONE"),
  ]),
});

export function isTradeRoute(value: unknown): value is TradeRoute {
  return typeof value === "string" && Object.hasOwn(FIXED_ROUTE_TEMPLATES, value);
}
