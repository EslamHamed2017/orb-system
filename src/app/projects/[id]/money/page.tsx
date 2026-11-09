import { SupplierInvoicePanel } from "../../../../ui/features/invoices/SupplierInvoicePanel";
import { SupplierShipmentInvoicePaymentPanel } from "../../../../ui/features/invoices/SupplierShipmentInvoicePaymentPanel";
import { AllocationPanel } from "../../../../ui/features/money/AllocationPanel";
import { MovementForm } from "../../../../ui/features/money/MovementForm";
import { ReversalDialog } from "../../../../ui/features/money/ReversalDialog";
import { SalesShipmentSettlementPanel } from "../../../../ui/features/money/SalesShipmentSettlementPanel";

type Query = { locale?: string; demoState?: string; role?: string };
export default async function MoneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar", canMutate = query.role !== "finance-viewer";
  const state = query.demoState;
  return <section aria-labelledby="money-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20 }}>
    <header><p><bdi>{id}</bdi> · {ar ? "مساحة مالية تشغيلية" : "Operational finance workspace"}</p><h1 id="money-title">{ar ? "الأموال" : "Money"}</h1><p>{ar ? "الحركات والتخصيصات والعكس سجلات غير قابلة للتغيير وتعيد حساب الحالة المالية فوراً." : "Movements, allocations and reversals are immutable records with immediate financial-state recalculation."}</p></header>
    {state === "invalid-allocation" && <section role="alert" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 16, padding: 16 }}><h2>{ar ? "رفض التخصيص" : "Allocation rejected"}</h2><p>{ar ? "يجب أن يتطابق الطرف والعملة. لم يتغير أي رصيد." : "The allocation requires the same party and currency; no balance changed."}</p></section>}
    {canMutate && <SupplierInvoicePanel locale={locale} />}
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}><SupplierShipmentInvoicePaymentPanel locale={locale} /><SalesShipmentSettlementPanel locale={locale} /></div>
    {canMutate && <MovementForm locale={locale} refund={state === "refund"} />}
    {canMutate && <AllocationPanel locale={locale} split={state === "split"} />}
    {canMutate && <ReversalDialog locale={locale} reversed={state === "reversed"} />}
    {(state === "split" || state === "refund") && <p role="status" style={{ background: "var(--orb-color-primary-container)", borderRadius: 12, padding: 12 }}>{ar ? "تمت المطابقة: فرق صفري USD 0.00" : "Reconciled with zero variance: USD 0.00"}</p>}
  </section>;
}
