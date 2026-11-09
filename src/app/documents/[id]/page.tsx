import s from "../../../ui/features/shipments/operations.module.css";
import { GenerationStatus } from "../../../ui/features/documents/GenerationStatus";
import { SalesShipmentDocumentsPanel } from "../../../ui/features/documents/SalesShipmentDocumentsPanel";
import { SharedFieldComparison } from "../../../ui/features/documents/SharedFieldComparison";
import { ApprovedSentComparison } from "../../../ui/features/outbound/ApprovedSentComparison";
import { ExactManifestPreview } from "../../../ui/features/outbound/ExactManifestPreview";
import { SendAttempts } from "../../../ui/features/outbound/SendAttempts";

type Query = { locale?: string; demoState?: string };
export default async function DocumentPage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<Query> }>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const sent = query.demoState === "sent", drift = query.demoState === "drift";
  return <section aria-labelledby="document-workspace-title" dir={ar ? "rtl" : "ltr"} className={s.page}>
    <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(ar ? "rtl" : "ltr")}` }} />
    <header className={s.pageHeader}><div><p className={s.eyebrow}>{ar ? "المستندات والإرسال" : "Documents & outbound"}</p><h1 id="document-workspace-title">{ar ? "مساحة المستند" : "Document workspace"}</h1><p>{ar ? "تظل المخرجات والاعتمادات ومحاولات الإرسال مرتبطة بالبايتات والإصدارات الدقيقة." : "Outputs, approvals, and send attempts remain bound to exact bytes and versions."}</p></div><span className={`${s.chip} ${s.success}`}>{ar ? "جاهز" : "Ready"}</span></header><div className={s.contextBar}><div className={s.contextItem}><span>{ar ? "المستند" : "Document"}</span><strong><bdi>{id}</bdi></strong></div><div className={s.contextItem}><span>{ar ? "الشحنة" : "Shipment"}</span><strong><bdi>ORB-SAL-0007</bdi></strong></div><div className={s.contextItem}><span>{ar ? "المراجعة" : "Revision"}</span><strong>2</strong></div></div><nav className={s.tabs} aria-label={ar ? "أقسام المستند" : "Document sections"}><a className={`${s.tab} ${s.tabActive}`} href="#generation">{ar ? "الإنشاء" : "Generation"}</a><a className={s.tab} href="#manifest">{ar ? "بيان الإرسال" : "Manifest"}</a><a className={s.tab} href="#attempts">{ar ? "محاولات الإرسال" : "Send attempts"}</a></nav>
    {drift && <section role="alert" className={`${s.notice} ${s.noticeError}`}><strong>{ar ? "تم حظر الإرسال" : "Send blocked"}</strong><p>{ar ? "لم يعد بيان الإرسال المعتمد يطابق البايتات المخزنة." : "The approved manifest no longer matches stored bytes."}</p></section>}
    <div id="generation"><GenerationStatus locale={locale} /></div>
    <SharedFieldComparison locale={locale} />
    <SalesShipmentDocumentsPanel locale={locale} />
    <div id="manifest"><ExactManifestPreview locale={locale} drift={drift} /></div>
    <ApprovedSentComparison locale={locale} sent={sent} />
    <div id="attempts"><SendAttempts locale={locale} sent={sent} /></div>
  </section>;
}
