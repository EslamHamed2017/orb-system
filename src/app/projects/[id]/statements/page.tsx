import { StatementTable } from "../../../../ui/features/statements/StatementTable";
import { SupplierShipmentStatementPanel } from "../../../../ui/features/statements/SupplierShipmentStatementPanel";
type Query = { locale?: string };
export default async function StatementsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]); const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const tabs = ar ? ["المشروع", "العميل", "المورد", "شحنة البيع", "شحنة المورد"] : ["Project", "Customer", "Supplier", "Sales shipment", "Supplier shipment"];
  return <section aria-labelledby="statements-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "أرصدة حسب العملة" : "Currency-partitioned balances"}</p><h1 id="statements-title">{ar ? "البيانات التشغيلية" : "Operational statements"}</h1><p>{ar ? "كل سطر مرتبط بمصدره، ولا تجمع العملات المختلفة." : "Every line links to its source; different currencies are never silently summed."}</p></header>
    <div role="tablist" aria-label={ar ? "أنواع البيان" : "Statement types"} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBlockEnd: 4 }}>{tabs.map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={index === 0} style={{ whiteSpace: "nowrap" }}>{tab}</button>)}</div>
    <StatementTable locale={locale} /><SupplierShipmentStatementPanel locale={locale} />
  </section>;
}
