import type { PersistedSalesShipment } from "../../../modules/shipments/load-persisted-sales-shipment";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { ShipmentAttachmentPanel } from "../evidence/ShipmentAttachmentPanel";
import s from "./operations.module.css";

function Fact({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

const STATE_LABELS = {
  DRAFT: ["Draft", "مسودة"], CONFIRMED: ["Confirmed", "مؤكدة"], IN_TRANSIT: ["In transit", "قيد النقل"],
  DELIVERED: ["Delivered", "تم التسليم"], CANCELLED: ["Cancelled", "ملغاة"], APPROVED: ["Approved", "معتمدة"],
  PENDING_APPROVAL: ["Pending approval", "بانتظار الموافقة"],
  SUPERSEDED: ["Superseded", "مستبدلة"], REJECTED: ["Rejected", "مرفوضة"],
} as const;
function stateLabel(state: string, locale: "en" | "ar"): string {
  const known = STATE_LABELS[state as keyof typeof STATE_LABELS];
  return known?.[locale === "ar" ? 1 : 0] ?? (locale === "ar" ? "حالة غير معروفة" : "Unknown status");
}

export function PersistedSalesShipmentUnavailable({ locale }: Readonly<{ locale: "en" | "ar" }>) {
  const ar = locale === "ar";
  return <article className={s.page} dir={ar ? "rtl" : "ltr"}><header className={s.pageHeader}><div><p className={s.eyebrow}>{ar ? "تنفيذ شحنة البيع" : "Sales execution"}</p><h1>{ar ? "بيانات الشحنة غير متاحة" : "Shipment data unavailable"}</h1><p role="status">{ar ? "قاعدة بيانات الشحنات غير متاحة؛ لم يتم عرض أي بيانات تجريبية." : "The shipment database is unavailable; no sample data is shown."}</p></div></header></article>;
}

export function PersistedSalesShipmentWorkspace({ locale, shipment }: Readonly<{ locale: "en" | "ar"; shipment: PersistedSalesShipment }>) {
  const ar = locale === "ar", d = shipment.dataset;
  const text = (en: string, arValue: string) => ar ? arValue : en;
  return <article data-persisted-sales-shipment className={s.page} dir={ar ? "rtl" : "ltr"}>
    <ProjectContextNavigation locale={locale} projectId={shipment.projectId} projectLabel={shipment.projectReference} current="salesShipment" recordId={shipment.reference} />
    <header className={s.pageHeader}><div><p className={s.eyebrow}>{text("Sales execution", "تنفيذ شحنة البيع")}</p><h1>{text("Sales shipment workspace", "مساحة شحنة البيع")}</h1><p>{text("Persisted shipment identity, logistics facts, dates, and evidence.", "هوية الشحنة المحفوظة وحقائق النقل والتواريخ والأدلة.")}</p></div><span className={`${s.chip} ${s.warning}`}>{stateLabel(shipment.executionState, locale)}</span></header>
    <div className={s.contextBar}><div className={s.contextItem}><span>{text("Reference", "المرجع")}</span><strong><bdi>{shipment.reference}</bdi></strong></div><div className={s.contextItem}><span>{text("Project", "المشروع")}</span><strong><bdi>{shipment.projectReference}</bdi></strong></div><div className={s.contextItem}><span>{text("Record version", "إصدار السجل")}</span><strong>{shipment.version}</strong></div>{d ? <div className={s.contextItem}><span>{text("Dataset revision", "مراجعة مجموعة البيانات")}</span><strong>{d.revision}</strong></div> : null}</div>
    {d ? <section className={s.card} aria-labelledby="persisted-dataset-title"><div className={s.sectionHeader}><div><p className={s.eyebrow}>{text("Active dataset", "مجموعة البيانات النشطة")}</p><h2 id="persisted-dataset-title">{d.productDescription}</h2><p>{text("These values are loaded from the active PostgreSQL shipment dataset.", "تُحمّل هذه القيم من مجموعة بيانات الشحنة النشطة في PostgreSQL.")}</p></div><span className={`${s.chip} ${s.success}`}>{stateLabel(d.state, locale)}</span></div>
      <dl className={s.metaGrid}>
        <Fact label={text("Quantity", "الكمية")} value={<bdi>{d.quantity}</bdi>} />
        <Fact label={text("Bags", "الأكياس")} value={d.bagCount} />
        <Fact label={text("Bag weight", "وزن الكيس")} value={<bdi>{d.bagWeight}</bdi>} />
        <Fact label={text("Net / gross weight", "الوزن الصافي / الإجمالي")} value={<bdi>{d.netWeight} / {d.grossWeight}</bdi>} />
        <Fact label={text("Origin / load", "المنشأ / التحميل")} value={<bdi>{d.originLocation} / {d.loadLocation}</bdi>} />
        <Fact label={text("Discharge / destination", "التفريغ / الوجهة")} value={<bdi>{d.dischargeLocation} / {d.destinationLocation}</bdi>} />
        <Fact label={text("Incoterm / named place", "شرط التجارة / المكان المسمى")} value={<bdi>{d.incoterm} / {d.namedPlace}</bdi>} />
        <Fact label={text("Carrier / transport", "الناقل / مرجع النقل")} value={<bdi>{d.carrier} / {d.transportReference}</bdi>} />
        <Fact label={text("Containers", "الحاويات")} value={<bdi>{d.containerNumbers.join(", ") || "—"}</bdi>} />
        <Fact label={text("Seals", "الأختام")} value={<bdi>{d.sealNumbers.join(", ") || "—"}</bdi>} />
        <Fact label={text("ETD", "المغادرة المتوقعة")} value={<bdi>{d.estimatedDeparture ?? "—"}</bdi>} />
        <Fact label={text("ETA", "الوصول المتوقع")} value={<bdi>{d.estimatedArrival ?? "—"}</bdi>} />
      </dl>
    </section> : <p role="status" className={s.notice}>{text("No active shipment dataset is attached.", "لا توجد مجموعة بيانات نشطة مرتبطة بالشحنة.")}</p>}
    <ShipmentAttachmentPanel locale={locale} projectId={shipment.projectId} subjectType="SALES_SHIPMENT" subjectId={shipment.id} attachments={shipment.attachments} canUpload={false} />
  </article>;
}
