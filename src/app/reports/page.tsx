import { QbReportsCenter } from "../../ui/features/reports/QbReports";

type Query = { readonly locale?: string };
export default async function ReportsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <QbReportsCenter locale={query.locale === "ar" ? "ar" : "en"} />;
}
