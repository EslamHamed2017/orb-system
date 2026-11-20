import { ProfitabilityReportLive } from "../../../ui/features/reports/ProfitabilityReportLive";

type Query = { readonly locale?: string; readonly q?: string };

export default async function ProjectProfitabilityReportRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const q = await searchParams;
  return <ProfitabilityReportLive locale={q.locale === "ar" ? "ar" : "en"} initialQuery={q.q ?? ""} />;
}
