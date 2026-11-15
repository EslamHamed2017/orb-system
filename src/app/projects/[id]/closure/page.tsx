import { AssessmentPanel } from "../../../../ui/features/closure/AssessmentPanel";
import { CloseReopenDialog } from "../../../../ui/features/closure/CloseReopenDialog";
import { SalesShipmentClosurePanel } from "../../../../ui/features/closure/SalesShipmentClosurePanel";
import { ProjectContextNavigation } from "../../../../ui/navigation/ProjectContextNavigation";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../../../../ui/features/admin/EnterpriseUx";
import { SavedProjectClosure } from "../../../../ui/features/projects/SavedProjectClosure";
type Query = { locale?: string; demoState?: string; role?: string };
type DemoState = "blocked" | "exception" | "approved" | "invalidated" | "closed";
const states = new Set<DemoState>(["blocked", "exception", "approved", "invalidated", "closed"]);
export default async function ClosurePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  if (id !== "demo") return <SavedProjectClosure id={decodeURIComponent(id)} locale={locale} />;
  const ar = locale === "ar", canManage = !query.role || query.role === "owner-admin", state = states.has(query.demoState as DemoState) ? query.demoState as DemoState : "blocked";
  return <section aria-labelledby="closure-title" dir={ar ? "rtl" : "ltr"} className="orb-erp"><EnterpriseStyles/><ProjectContextNavigation locale={locale} projectId={id} current="closure"/><ErpPageHeader titleId="closure-title" eyebrow={<><bdi>{id}</bdi><span>•</span>{ar ? "حوكمة الإغلاق" : "Closure governance"}</>} title={ar ? "إغلاق المشروع" : "Project closure"} description={ar ? "تقييم قائم على الإصدار يجمع الجاهزية التشغيلية والمالية والمستندية." : "A version-bound assessment combining operational, financial and documentary readiness."} meta={<span className="orb-chip" data-tone={state === "closed" ? "success" : "warning"}>{state.toUpperCase()}</span>}/><div className="orb-summary-grid"><Kpi label={ar ? "إصدار المشروع" : "Project version"} value="14"/><Kpi label={ar ? "موانع نشطة" : "Active blockers"} value="7"/><Kpi label={ar ? "مؤهل للاستثناء" : "Exception eligible"} value="3"/><Kpi label={ar ? "آخر تقييم" : "Last assessed"} value={<bdi>ASSESSMENT-0014</bdi>}/></div><AssessmentPanel locale={locale}/>{canManage && <CloseReopenDialog locale={locale} state={state}/>}<SalesShipmentClosurePanel locale={locale}/></section>;
}
