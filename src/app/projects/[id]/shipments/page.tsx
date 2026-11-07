import { ShipmentWorkspaceCore } from "../../../../ui/features/shipments/ShipmentWorkspaceCore";
import type { ShipmentUiState } from "../../../../ui/features/shipments/ExecutionActions";

type Query = { locale?: string; state?: string; demoState?: string };
function uiState(value: string | undefined): ShipmentUiState {
  return (["draft", "confirmed", "in-transit", "received", "delivered", "cancelled", "rejected"] as const).includes(value as ShipmentUiState) ? value as ShipmentUiState : "confirmed";
}

export default async function ProjectShipmentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar", state = uiState(query.state);
  const demoState = (["tolerance", "stale", "replay", "post-transit"] as const).find((value) => value === query.demoState) ?? null;
  const supplierState: ShipmentUiState = state === "delivered" ? "received" : state;
  const salesState: ShipmentUiState = state === "received" ? "delivered" : state;
  return <section aria-labelledby="shipments-title" style={{ display: "grid", gap: 20 }}>
    <header><p><bdi>{id}</bdi></p><h1 id="shipments-title">{ar ? "الشحنات" : "Shipments"}</h1><p>{ar ? "مجموعات بيانات منفصلة للمورد والبيع، ومصدر أساسي واحد، وتنفيذ مضبوط بالرسم البياني." : "Separate supplier and sales datasets, one primary source, and graph-controlled execution."}</p></header>
    {demoState === "stale" && <section role="alert" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 16, padding: 16 }}><h2>{ar ? "يوجد إصدار أحدث" : "A newer version exists"}</h2><p>{ar ? "لم يتم استبدال عملك. حمّل أحدث إصدار وقارن التغييرات." : "Your work was not overwritten. Reload the latest version and compare changes."}</p><button type="button">{ar ? "تحميل أحدث إصدار" : "Reload latest"}</button></section>}
    {demoState === "replay" && <section role="status" style={{ borderRadius: 16, padding: 16, background: "var(--orb-color-primary-container)" }}><h2>{ar ? "تم تطبيق الطلب مسبقاً" : "Request already applied"}</h2><p>{ar ? "أعيدت النتيجة الأصلية ولم تتم إضافة حدث مكرر." : "The original result was returned; no duplicate event was appended."}</p></section>}
    {demoState === "post-transit" && <section role="alert" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 16, padding: 16 }}><h2>{ar ? "المراجعة غير متاحة" : "Revision unavailable"}</h2><p>{ar ? "الشحنة قيد النقل؛ يحتفظ النظام بالسجل ولا يسمح بمراجعة مجموعة البيانات بعد بدء النقل." : "The shipment is in transit; history is preserved and dataset revision is unavailable after transit starts."}</p></section>}
    <div style={{ display: "grid", gap: 20 }}>
      <ShipmentWorkspaceCore kind="supplier" locale={locale} state={supplierState} demoState={demoState} />
      <ShipmentWorkspaceCore kind="sales" locale={locale} state={salesState} demoState={demoState} />
    </div>
  </section>;
}
