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
  return <section aria-labelledby="document-workspace-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20 }}>
    <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(ar ? "rtl" : "ltr")}` }} />
    <header><p><bdi>{id}</bdi> · <bdi>ORB-SAL-0007</bdi></p><h1 id="document-workspace-title">{ar ? "مساحة المستند" : "Document workspace"}</h1><p>{ar ? "تظل المخرجات والاعتمادات ومحاولات الإرسال مرتبطة بالبايتات والإصدارات الدقيقة." : "Outputs, approvals and send attempts remain bound to exact bytes and versions."}</p></header>
    {drift && <section role="alert" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 16, padding: 16 }}><strong>{ar ? "تم حظر الإرسال" : "Send blocked"}</strong><p>{ar ? "لم يعد بيان الإرسال المعتمد يطابق البايتات المخزنة." : "The approved manifest no longer matches stored bytes."}</p></section>}
    <GenerationStatus locale={locale} />
    <SharedFieldComparison locale={locale} />
    <SalesShipmentDocumentsPanel locale={locale} />
    <ExactManifestPreview locale={locale} drift={drift} />
    <ApprovedSentComparison locale={locale} sent={sent} />
    <SendAttempts locale={locale} sent={sent} />
  </section>;
}
