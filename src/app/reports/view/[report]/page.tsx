import { redirect } from "next/navigation";
import { QbReportPage } from "../../../../ui/features/reports/QbReports";
import { QB_REPORT_KEYS, type QbReportKey } from "../../../../ui/features/reports/qb-reports";

type Query = { readonly locale?: string; readonly from?: string; readonly to?: string; readonly asOf?: string; readonly projectId?: string };
export default async function QbReportRoute({ params, searchParams }: { readonly params: Promise<{ report: string }>; readonly searchParams: Promise<Query> }) {
  const [{ report }, query] = await Promise.all([params, searchParams]);
  if (!QB_REPORT_KEYS.includes(report as QbReportKey)) redirect(`/reports?locale=${query.locale === "ar" ? "ar" : "en"}`);
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return <QbReportPage reportKey={report as QbReportKey} locale={query.locale === "ar" ? "ar" : "en"} from={date(query.from)} to={date(query.to)} asOf={date(query.asOf)} projectId={query.projectId} />;
}
