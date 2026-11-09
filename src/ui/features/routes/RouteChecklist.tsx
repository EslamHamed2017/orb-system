export type RouteChecklistLocale = "ar" | "en";
export type RouteChecklistItemState = "NOT_STARTED" | "IN_PROGRESS" | "SATISFIED" | "NOT_APPLICABLE_BY_RULE";
export interface RouteChecklistItemView { readonly id: string; readonly code: string; readonly kind: "FACT" | "EVIDENCE" | "MILESTONE"; readonly state: RouteChecklistItemState }
export interface RouteChecklistView { readonly shipmentId: string; readonly templateVersion: number; readonly version: number; readonly items: readonly RouteChecklistItemView[] }

const labels: Readonly<Record<string, Readonly<{ en: string; ar: string }>>> = {
  ORIGIN_AND_DESTINATION: { en: "Origin and destination", ar: "المنشأ والوجهة" }, TRANSPORT_REFERENCE: { en: "Transport reference", ar: "مرجع النقل" }, ORIGIN_EXPORT_EVIDENCE: { en: "Origin/export evidence", ar: "دليل المنشأ والتصدير" }, DEPARTURE: { en: "Departure", ar: "المغادرة" }, ARRIVAL: { en: "Arrival", ar: "الوصول" }, DELIVERY: { en: "Delivery", ar: "التسليم" },
  FREE_ZONE_ENTRY: { en: "Free-zone entry evidence", ar: "دليل الدخول إلى المنطقة الحرة" }, STORAGE_HANDLING: { en: "Storage and handling evidence", ar: "دليل التخزين والمناولة" }, REEXPORT_CUSTOMS: { en: "Exit/re-export customs evidence", ar: "دليل جمارك الخروج وإعادة التصدير" }, OUTBOUND_TRANSPORT: { en: "Outbound transport", ar: "النقل الصادر" },
  UAE_IMPORT_DECLARATION: { en: "UAE import declaration", ar: "بيان الاستيراد الإماراتي" }, CUSTOMS_CLEARANCE_AND_CHARGES: { en: "Customs clearance and assessed charges", ar: "التخليص الجمركي والرسوم المقدرة" }, INBOUND_TRANSPORT: { en: "Inbound transport", ar: "النقل الوارد" }, RELEASE: { en: "Release", ar: "الإفراج" },
};
const stateLabels = { en: { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", SATISFIED: "Satisfied", NOT_APPLICABLE_BY_RULE: "Not applicable by rule" }, ar: { NOT_STARTED: "لم يبدأ", IN_PROGRESS: "قيد التنفيذ", SATISFIED: "مكتمل", NOT_APPLICABLE_BY_RULE: "غير منطبق حسب القاعدة" } } as const;

export function RouteChecklist({ locale, checklist }: Readonly<{ locale: RouteChecklistLocale; checklist: RouteChecklistView }>) {
  const ar = locale === "ar";
  return <section aria-labelledby="route-checklist-title" aria-label={ar ? "قائمة مسار الشحنة" : "Route checklist"} style={{ display: "grid", gap: 16 }}>
    <header><h2 id="route-checklist-title">{ar ? "قائمة مسار الشحنة" : "Route checklist"}</h2><p>{ar ? `إصدار القالب ${checklist.templateVersion} · إصدار القائمة ${checklist.version}` : `Template version ${checklist.templateVersion} · Checklist version ${checklist.version}`}</p></header>
    <ol style={{ display: "grid", gap: 12, paddingInlineStart: 24 }}>{checklist.items.map((item) => <li key={item.id} style={{ padding: 12, border: "1px solid var(--orb-color-outline-variant)", borderRadius: 12 }}>
      <strong>{labels[item.code]?.[locale] ?? item.code}</strong><p>{stateLabels[locale][item.state]}</p>
      {item.state !== "NOT_APPLICABLE_BY_RULE" && item.kind === "EVIDENCE" ? <button type="button" data-operation-id="updateRouteEvidenceOrMilestone">{ar ? "رفع دليل" : "Upload evidence"}</button> : null}
      {item.state !== "NOT_APPLICABLE_BY_RULE" && item.kind === "MILESTONE" ? <button type="button" data-operation-id="updateRouteEvidenceOrMilestone">{ar ? "إكمال المرحلة" : "Complete milestone"}</button> : null}
    </li>)}</ol>
    <a href={`/projects/demo/closure?shipmentId=${checklist.shipmentId}`}>{ar ? "عرض عائق الإغلاق" : "View closure blocker"}</a>
  </section>;
}
