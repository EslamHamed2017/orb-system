import { ExpenseCorrectionDialog } from "../expenses/ExpenseCorrectionDialog";
import { ExpenseForm } from "../expenses/ExpenseForm";
import { ExpenseHistory } from "../expenses/ExpenseHistory";
import { SalesShipmentExpensePanel } from "../expenses/SalesShipmentExpensePanel";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";

export function LegacyProjectExpensesDemo({ id, locale, demoState, role }: Readonly<{ id: string; locale: "ar" | "en"; demoState?: string; role?: string }>) {
  const ar=locale==="ar", applied=demoState==="applied", canMutate=role!=="finance-viewer";
  return <section aria-labelledby="expenses-title" dir={ar?"rtl":"ltr"} className="orb-erp"><EnterpriseStyles/><ProjectContextNavigation locale={locale} projectId={id} current="expenses" />
<ErpPageHeader titleId="expenses-title" eyebrow={<><bdi>{id}</bdi><span>•</span>{ar?"دفتر المصروفات":"Expense ledger"}</>} title={ar?"المصروفات المباشرة":"Direct expenses"} description={ar?"أنشئ وراجع وصحح المصروفات مع الحفاظ على الأصل وسلسلة الموافقة.":"Capture, review and correct direct costs while preserving originals and the approval chain."} meta={<span className="orb-chip" data-tone="warning">{ar?"1 بانتظار المراجعة":"1 pending review"}</span>}/>
<div className="orb-summary-grid"><Kpi label={ar?"إجمالي معتمد":"Approved total"} value={<bdi>USD {applied?"1,100.00":"1,250.00"}</bdi>}/><Kpi label={ar?"هذا الشهر":"This month"} value={<bdi>USD 1,250.00</bdi>}/><Kpi label={ar?"غير مخصص":"Unallocated"} value={<bdi>USD 0.00</bdi>}/><Kpi label={ar?"السجلات":"Ledger entries"} value={applied?"2":"1"} detail={ar?"أصل محفوظ":"Original retained"}/></div>
{canMutate&&<ExpenseForm locale={locale}/>} {canMutate&&<ExpenseHistory locale={locale} applied={applied}/>} {canMutate&&demoState==="correction"&&<ExpenseCorrectionDialog locale={locale}/>} {applied&&<p role="status">{ar?"تم تطبيق التصحيح؛ أعيد حساب البيان والهامش، وأبطل تقييم الإغلاق، وأعيد فتح الإغلاق النهائي.":"Correction applied · Statement recomputed · Margin recomputed · Closure assessment invalidated · Final close reopened."}</p>}<SalesShipmentExpensePanel locale={locale}/></section>
}
