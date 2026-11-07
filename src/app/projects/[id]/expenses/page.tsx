import { ExpenseCorrectionDialog } from "../../../../ui/features/expenses/ExpenseCorrectionDialog";
import { ExpenseForm } from "../../../../ui/features/expenses/ExpenseForm";
import { ExpenseHistory } from "../../../../ui/features/expenses/ExpenseHistory";
import { SalesShipmentExpensePanel } from "../../../../ui/features/expenses/SalesShipmentExpensePanel";

type Query = { locale?: string; demoState?: string };
export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar", applied = query.demoState === "applied";
  return <section aria-labelledby="expenses-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "سجل تشغيلي غير قابل للتغيير" : "Immutable operational record"}</p><h1 id="expenses-title">{ar ? "المصروفات المباشرة" : "Direct expenses"}</h1><p>{ar ? "لكل مصروف نطاق مشروع واحد أو شحنة بيع واحدة، وتصحيح المصروف المعتمد يلغي الأصل ويضيف بديلاً مرتبطاً." : "Each expense has one Project or sales-shipment scope; an approved correction cancels the original and appends a linked replacement."}</p></header>
    <ExpenseForm locale={locale} />
    <ExpenseHistory locale={locale} applied={applied} />
    {query.demoState === "correction" && <ExpenseCorrectionDialog locale={locale} />}
    {applied && <p role="status" style={{ background: "var(--orb-color-primary-container)", borderRadius: 12, padding: 12 }}>{ar ? "تم تطبيق التصحيح؛ أعيد حساب البيان والهامش، وأبطل تقييم الإغلاق، وأعيد فتح الإغلاق النهائي." : "Correction applied · Statement recomputed · Margin recomputed · Closure assessment invalidated · Final close reopened."}</p>}
    <SalesShipmentExpensePanel locale={locale} />
  </section>;
}
