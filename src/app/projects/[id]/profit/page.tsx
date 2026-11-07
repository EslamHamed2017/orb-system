import { ProfitCards } from "../../../../ui/features/profit/ProfitCards";
import { SourceDrilldown } from "../../../../ui/features/profit/SourceDrilldown";
type Query = { locale?: string; demoState?: string; role?: string };
export default async function ProfitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]); const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  return <section aria-labelledby="profit-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "أربع مقاييس مستقلة" : "Four independent measures"}</p><h1 id="profit-title">{ar ? "الربح والنقد" : "Profit and cash"}</h1><p>{ar ? "حتى 30 نوفمبر 2026" : "As of 30 Nov 2026"}</p></header>
    <ProfitCards locale={locale} />
    {query.demoState === "drilldown" && <SourceDrilldown locale={locale} restricted={query.role === "operations"} />}
  </section>;
}
