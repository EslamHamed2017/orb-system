import { AccountsReportLive } from "../../../ui/features/reports/AccountsReportLive";

type Query = { readonly locale?: string; readonly from?: string; readonly to?: string };

export default async function AccountsReportRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const q = await searchParams;
  return <AccountsReportLive locale={q.locale === "ar" ? "ar" : "en"} from={q.from} to={q.to} />;
}
