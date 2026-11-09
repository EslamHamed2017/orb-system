import { AssessmentPanel } from "../../../../ui/features/closure/AssessmentPanel";
import { CloseReopenDialog } from "../../../../ui/features/closure/CloseReopenDialog";
import { SalesShipmentClosurePanel } from "../../../../ui/features/closure/SalesShipmentClosurePanel";

type Query = { locale?: string; demoState?: string; role?: string };
type DemoState = "blocked" | "exception" | "approved" | "invalidated" | "closed";
const states = new Set<DemoState>(["blocked", "exception", "approved", "invalidated", "closed"]);
export default async function ClosurePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar", canManage = !query.role || query.role === "owner-admin";
  const state = states.has(query.demoState as DemoState) ? query.demoState as DemoState : "blocked";
  return <section aria-labelledby="closure-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "أساس إغلاق مضبوط بالإصدار" : "Version-controlled closure basis"}</p><h1 id="closure-title">{ar ? "إغلاق المشروع" : "Project closure"}</h1><p>{ar ? "التقييم الحديث والموافقة الدقيقة مطلوبان للإغلاق النهائي أو إعادة الفتح." : "A fresh assessment and exact approval are required for final close or reopen."}</p></header>
    <AssessmentPanel locale={locale} />
    {canManage && <CloseReopenDialog locale={locale} state={state} />}
    <SalesShipmentClosurePanel locale={locale} />
  </section>;
}
