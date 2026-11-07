import { SupplierShipmentWorkspace } from "../../../ui/features/shipments/SupplierShipmentWorkspace";
import type { ShipmentUiState } from "../../../ui/features/shipments/ExecutionActions";
import type { WorkspaceRole } from "../../../ui/features/shipments/workspace-tabs";

type Query = { locale?: string; role?: string; state?: string };
function role(value: string | undefined): WorkspaceRole { return value === "finance-viewer" ? "finance-viewer" : value === "owner-admin" ? "owner-admin" : "operations"; }
function state(value: string | undefined): ShipmentUiState { return (["draft", "confirmed", "in-transit", "received", "cancelled", "rejected"] as const).includes(value as never) ? value as ShipmentUiState : "confirmed"; }
export default async function SupplierShipmentPage({ searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<Query> }>) {
  const query = await searchParams;
  return <SupplierShipmentWorkspace locale={query.locale === "ar" ? "ar" : "en"} role={role(query.role)} state={state(query.state)} />;
}
