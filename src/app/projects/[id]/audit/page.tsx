import { AuditTimeline } from "../../../../ui/features/audit/AuditTimeline";
type Query = { locale?: string };
export default async function AuditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]), locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  return <section aria-labelledby="audit-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}><header><p><bdi>{id}</bdi></p><h1 id="audit-title">{ar ? "تدقيق المشروع" : "Project audit"}</h1></header><AuditTimeline locale={locale} /></section>;
}
