import { ShipmentDocumentPrint } from "../../../../ui/features/documents/TradeDocuments";

type Query = { readonly locale?: string };
export default async function ShipmentDocumentPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ShipmentDocumentPrint shipmentId={id} document="packing-list" locale={query.locale === "ar" ? "ar" : "en"} />;
}
