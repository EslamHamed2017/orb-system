import { ContractPrint } from "../../../../ui/features/documents/TradeDocuments";

type Query = { readonly locale?: string; readonly projectId?: string };
export default async function ContractPrintPage({ params, searchParams }: { readonly params: Promise<{ contractId: string }>; readonly searchParams: Promise<Query> }) {
  const [{ contractId }, query] = await Promise.all([params, searchParams]);
  return <ContractPrint contractId={contractId} projectId={query.projectId ?? ""} locale={query.locale === "ar" ? "ar" : "en"} />;
}
