import { SupplierInvoicePanel } from "../../../../ui/features/invoices/SupplierInvoicePanel";
import { SupplierShipmentInvoicePaymentPanel } from "../../../../ui/features/invoices/SupplierShipmentInvoicePaymentPanel";
import { AllocationPanel } from "../../../../ui/features/money/AllocationPanel";
import { MovementForm } from "../../../../ui/features/money/MovementForm";
import { ReversalDialog } from "../../../../ui/features/money/ReversalDialog";
import { SalesShipmentSettlementPanel } from "../../../../ui/features/money/SalesShipmentSettlementPanel";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../../../../ui/features/admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../../../ui/navigation/ProjectContextNavigation";
type Query = { locale?: string; demoState?: string; role?: string };
export default async function MoneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
 const [{ id }, query] = await Promise.all([params, searchParams]); const locale=query.locale==="ar"?"ar":"en", ar=locale==="ar", canMutate=query.role!=="finance-viewer", state=query.demoState;
 return <section aria-labelledby="money-title" dir={ar?"rtl":"ltr"} className="orb-erp"><EnterpriseStyles /><ProjectContextNavigation locale={locale} projectId={id} current="accounts" />
  <ErpPageHeader titleId="money-title" eyebrow={<><bdi>{id}</bdi><span>•</span>{ar?"الرقابة المالية":"Finance control"}</>} title={ar?"الأموال":"Money"} description={ar?"سجل موحد للحركات والفواتير والتخصيصات العكسية، مع أرصدة محدثة وقابلية تدقيق كاملة.":"A unified ledger for movements, invoices, allocations and compensating reversals—with live balances and full traceability."} meta={<span className="orb-chip" data-tone="success">{ar?"متوازن":"Reconciled"}</span>} />
  <div className="orb-summary-grid"><Kpi label={ar?"النقد المتاح":"Available cash"} value={<bdi>USD 7,500.00</bdi>} detail={ar?"بعد التخصيصات":"After allocations"}/><Kpi label={ar?"ذمم المورد":"Supplier payable"} value={<bdi>USD 7,500.00</bdi>} detail="INV-2026-117"/><Kpi label={ar?"ذمم العميل":"Customer receivable"} value={<bdi>USD 6,000.00</bdi>} detail="ORB-SAL-0007"/><Kpi label={ar?"فرق التسوية":"Reconciliation variance"} value={<bdi>USD 0.00</bdi>} detail={ar?"حتى الآن":"As of today"}/></div>
  {state==="invalid-allocation"&&<section role="alert"><h2>{ar?"رفض التخصيص":"Allocation rejected"}</h2><p>{ar?"يجب أن يتطابق الطرف والعملة. لم يتغير أي رصيد.":"The allocation requires the same party and currency; no balance changed."}</p></section>}
  <div className="orb-split">{canMutate&&<SupplierInvoicePanel locale={locale}/>}<div className="orb-page-grid"><SupplierShipmentInvoicePaymentPanel locale={locale}/><SalesShipmentSettlementPanel locale={locale}/></div></div>
  {canMutate&&<MovementForm locale={locale} refund={state==="refund"}/>} {canMutate&&<AllocationPanel locale={locale} split={state==="split"}/>} {canMutate&&<ReversalDialog locale={locale} reversed={state==="reversed"}/>} {(state==="split"||state==="refund")&&<p role="status">{ar?"تمت المطابقة: فرق صفري USD 0.00":"Reconciled with zero variance: USD 0.00"}</p>}
 </section>;
}