import s from "../../../ui/features/shipments/operations.module.css";
import { EvidenceViewer, type EvidenceViewerMetadata } from "../../../ui/features/evidence/EvidenceViewer";
import { SalesShipmentRouteEvidencePanel } from "../../../ui/features/routes/SalesShipmentRouteEvidencePanel";
import type { RouteChecklistItemView } from "../../../ui/features/routes/RouteChecklist";

const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000000801";
const routeItems = {
  FOREIGN_TO_FOREIGN: [["ORIGIN_AND_DESTINATION", "FACT"], ["TRANSPORT_REFERENCE", "FACT"], ["ORIGIN_EXPORT_EVIDENCE", "EVIDENCE"], ["DEPARTURE", "MILESTONE"], ["ARRIVAL", "MILESTONE"], ["DELIVERY", "MILESTONE"]],
  UAE_FREE_ZONE_REEXPORT: [["FREE_ZONE_ENTRY", "EVIDENCE"], ["STORAGE_HANDLING", "EVIDENCE"], ["REEXPORT_CUSTOMS", "EVIDENCE"], ["OUTBOUND_TRANSPORT", "EVIDENCE"], ["DELIVERY", "MILESTONE"]],
  UAE_IMPORT: [["UAE_IMPORT_DECLARATION", "EVIDENCE"], ["CUSTOMS_CLEARANCE_AND_CHARGES", "EVIDENCE"], ["INBOUND_TRANSPORT", "EVIDENCE"], ["RELEASE", "MILESTONE"], ["DELIVERY", "MILESTONE"]],
} as const;
type RouteName = keyof typeof routeItems;

export default async function EvidencePage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const requestedRoute = typeof query.route === "string" ? query.route : "UAE_IMPORT";
  const route: RouteName = Object.hasOwn(routeItems, requestedRoute) ? requestedRoute as RouteName : "UAE_IMPORT";
  const pending = query.verification === "pending";
  const storageHandlingUsed = query.storageHandlingUsed !== "false";
  const items: RouteChecklistItemView[] = routeItems[route].map(([code, kind], index) => ({
    id: `route-item-${index + 1}`,
    code,
    kind,
    state: code === "STORAGE_HANDLING" && !storageHandlingUsed ? "NOT_APPLICABLE_BY_RULE" : index === 0 ? "SATISFIED" : "NOT_STARTED",
  }));
  const metadata: EvidenceViewerMetadata = {
    id,
    sha256: "a".repeat(64),
    byteLength: 1024,
    mediaType: "application/pdf",
    originalFilename: "origin-export-evidence.pdf",
    verificationState: pending ? "PENDING" : "VERIFIED",
    verifiedAt: pending ? null : "2026-11-07T08:00:00.000Z",
    verifiedBy: pending ? null : { displayName: "Owner Admin" },
    sourceLinks: [{ reference: "ORB-SAL-0007", href: `/sales-shipments/${SHIPMENT_ID}`, purpose: locale === "ar" ? "دليل مسار الشحنة" : "Shipment route evidence" }],
  };
  return <div className={s.page}>
   <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(ar ? "rtl" : "ltr")}` }} />
    <EvidenceViewer locale={locale} metadata={metadata} />
    <SalesShipmentRouteEvidencePanel locale={locale} checklist={{ shipmentId: SHIPMENT_ID, templateVersion: 1, version: 3, items }} />
  </div>;
}
