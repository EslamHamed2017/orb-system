import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { SalesShipmentPlanningPage } from "../../../../ui/features/shipments/SalesShipmentPlanningPage";
import { SupplierShipmentPlanningPage } from "../../../../ui/features/shipments/SupplierShipmentPlanningPage";
import { ContractApprovalStrip } from "../../../../ui/features/contracts/ContractApprovalStrip";
import s from "../../../../ui/features/shipments/operations.module.css";
import { ProjectContextNavigation } from "../../../../ui/navigation/ProjectContextNavigation";

type Query = { readonly locale?: string; readonly flow?: string };

export default async function ProjectShipmentsPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const decodedId = decodeURIComponent(id);
  if (!isSavedProjectId(decodedId)) return <RetiredBrowserProject locale={locale} />;
  const flow = query.flow === "sales" ? "sales" : "supplier";
  const base = `/projects/${encodeURIComponent(decodedId)}/shipments?locale=${locale}`;
  return <>
    <ProjectContextNavigation locale={locale} projectId={decodedId} current="shipments"/>
    <style>{".shipments-body [data-project-context-navigation]{display:none}"}</style>
    <ContractApprovalStrip projectId={decodedId} locale={locale}/>
    <nav className={s.tabs} aria-label={ar ? "نوع تخطيط الشحنة" : "Shipment planning type"}>
      <a className={`${s.tab} ${flow === "supplier" ? s.tabActive : ""}`} aria-current={flow === "supplier" ? "page" : undefined} href={`${base}&flow=supplier`}>{ar ? "وارد من المورد" : "Supplier inbound"}</a>
      <a className={`${s.tab} ${flow === "sales" ? s.tabActive : ""}`} aria-current={flow === "sales" ? "page" : undefined} href={`${base}&flow=sales`}>{ar ? "صادر إلى العميل" : "Customer outbound"}</a>
    </nav>
    <div className="shipments-body">{flow === "sales" ? <SalesShipmentPlanningPage id={decodedId} locale={locale}/> : <SupplierShipmentPlanningPage id={decodedId} locale={locale}/>}</div>
  </>;
}
