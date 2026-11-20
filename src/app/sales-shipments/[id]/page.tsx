import { ShipmentExecutionWorkspace } from "../../../ui/features/shipments/ShipmentExecutionWorkspace";
import { RetiredBrowserProject } from "../../../ui/features/projects/RetiredBrowserProject";

type Query = { readonly locale?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Shipments live in the database; any other link is an old browser-only or sample record. */
export default async function SalesShipmentPage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<Query> }>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  return UUID.test(id) ? <ShipmentExecutionWorkspace kind="SALES" shipmentId={id} locale={locale} /> : <RetiredBrowserProject locale={locale} />;
}
