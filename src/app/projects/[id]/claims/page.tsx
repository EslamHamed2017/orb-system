import { ClaimWorkspace } from "../../../../ui/features/claims/ClaimWorkspace";
import { SalesShipmentClaimsPanel } from "../../../../ui/features/claims/SalesShipmentClaimsPanel";

type Query = { locale?: string; demoState?: string };
type DemoState = "open" | "pending" | "rejected" | "approved" | "resolved";
const states = new Set<DemoState>(["open", "pending", "rejected", "approved", "resolved"]);

export default async function ClaimsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const demoState = states.has(query.demoState as DemoState) ? query.demoState as DemoState : "open";
  return <section aria-labelledby="claims-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "نتائج مضبوطة بالموافقة" : "Approval-controlled outcomes"}</p><h1 id="claims-title">{ar ? "المطالبات البسيطة" : "Simple claims"}</h1><p>{ar ? "تسجل النسخة الأولى النتيجة فقط؛ لا توجد تسويات متقدمة أو إجراءات نهائية مباشرة." : "Release 1 records the outcome only; terminal state requires an exact approved proposal."}</p></header>
    <ClaimWorkspace locale={locale} demoState={demoState} />
    <SalesShipmentClaimsPanel locale={locale} />
  </section>;
}
