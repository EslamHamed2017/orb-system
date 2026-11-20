import { ReceiptPrint } from "../../../../ui/features/documents/TradeDocuments";

type Query = { readonly locale?: string; readonly projectId?: string };
export default async function ReceiptPage({ params, searchParams }: { readonly params: Promise<{ movementId: string }>; readonly searchParams: Promise<Query> }) {
  const [{ movementId }, query] = await Promise.all([params, searchParams]);
  return <ReceiptPrint movementId={movementId} projectId={query.projectId ?? ""} locale={query.locale === "ar" ? "ar" : "en"} />;
}
