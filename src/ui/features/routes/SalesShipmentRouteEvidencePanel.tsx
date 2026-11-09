import s from "../shipments/operations.module.css";
import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { RouteChecklist, type RouteChecklistView } from "./RouteChecklist";

export function SalesShipmentRouteEvidencePanel({ locale, checklist }: Readonly<{ locale: "ar" | "en"; checklist: RouteChecklistView }>) {
  return <section className={s.stack}>
    <RouteChecklist locale={locale} checklist={checklist} />
    <EvidenceUploader locale={locale} subjectId={checklist.shipmentId} />
  </section>;
}
