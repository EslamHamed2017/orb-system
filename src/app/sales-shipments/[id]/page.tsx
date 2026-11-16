import { notFound } from "next/navigation";
import { loadPersistedSalesShipment } from "../../../modules/shipments/load-persisted-sales-shipment";
import { PersistedSalesShipmentUnavailable, PersistedSalesShipmentWorkspace } from "../../../ui/features/shipments/PersistedSalesShipmentWorkspace";
import { SalesShipmentWorkspace } from "../../../ui/features/shipments/SalesShipmentWorkspace";
import type { ShipmentUiState } from "../../../ui/features/shipments/ExecutionActions";
import type { WorkspaceRole } from "../../../ui/features/shipments/workspace-tabs";

type Query = { locale?: string; role?: string; state?: string; projectId?: string };
function role(value: string | undefined): WorkspaceRole { return value === "finance-viewer" ? "finance-viewer" : value === "owner-admin" ? "owner-admin" : "operations"; }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function state(value: string | undefined): ShipmentUiState { return (["draft", "confirmed", "in-transit", "delivered", "cancelled", "rejected"] as const).includes(value as never) ? value as ShipmentUiState : "confirmed"; }
export default async function SalesShipmentPage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<Query> }>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  if (isUuid(id)) {
    if (!query.projectId) notFound();
    if (!process.env.DATABASE_URL) return <PersistedSalesShipmentUnavailable locale={locale} />;
    const shipment = await loadPersistedSalesShipment(id, query.projectId);
    if (!shipment) notFound();
    return <PersistedSalesShipmentWorkspace locale={locale} shipment={shipment} />;
  }
  return <SalesShipmentWorkspace locale={locale} role={role(query.role)} state={state(query.state)} projectId={query.projectId ?? "demo"} shipmentId={id} />;
}
