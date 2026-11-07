import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { RouteChecklist, type RouteChecklistView } from "./RouteChecklist";

export function SalesShipmentRouteEvidencePanel({ locale, checklist }: Readonly<{ locale: "ar" | "en"; checklist: RouteChecklistView }>) {
  return <section style={{ display: "grid", gap: 24 }}>
    <RouteChecklist locale={locale} checklist={checklist} />
    <EvidenceUploader locale={locale} subjectId={checklist.shipmentId} />
  </section>;
}
