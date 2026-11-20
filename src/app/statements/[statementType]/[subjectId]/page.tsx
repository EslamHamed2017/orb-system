import { StatementPrint } from "../../../../ui/features/documents/TradeDocuments";

type Query = { readonly locale?: string; readonly asOf?: string; readonly from?: string };
export default async function StatementPage({ params, searchParams }: { readonly params: Promise<{ statementType: string; subjectId: string }>; readonly searchParams: Promise<Query> }) {
  const [{ statementType, subjectId }, query] = await Promise.all([params, searchParams]);
  return <StatementPrint type={statementType} id={subjectId} locale={query.locale === "ar" ? "ar" : "en"} asOf={query.asOf} from={query.from} />;
}
