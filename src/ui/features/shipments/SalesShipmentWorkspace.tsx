import { SalesShipmentClaimsPanel } from "../claims/SalesShipmentClaimsPanel";
import { SalesShipmentClosurePanel } from "../closure/SalesShipmentClosurePanel";
import { SalesShipmentDocumentsPanel } from "../documents/SalesShipmentDocumentsPanel";
import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { SalesShipmentExpensePanel } from "../expenses/SalesShipmentExpensePanel";
import { SalesShipmentSettlementPanel } from "../money/SalesShipmentSettlementPanel";
import { RouteChecklist, type RouteChecklistView } from "../routes/RouteChecklist";
import { ShipmentWorkspaceCore } from "./ShipmentWorkspaceCore";
import type { ShipmentUiState } from "./ExecutionActions";
import { tabsFor, type WorkspaceLocale, type WorkspaceRole } from "./workspace-tabs";

const checklist: RouteChecklistView = { shipmentId: "demo", templateVersion: 1, version: 3, items: [
  { id: "route-origin", code: "ORIGIN_AND_DESTINATION", kind: "FACT", state: "SATISFIED" },
  { id: "route-evidence", code: "ORIGIN_EXPORT_EVIDENCE", kind: "EVIDENCE", state: "IN_PROGRESS" },
  { id: "route-delivery", code: "DELIVERY", kind: "MILESTONE", state: "NOT_STARTED" },
] };
const panelStyle = { display: "grid", gap: 16, scrollMarginBlockStart: 80 } as const;
function TabList({ locale, role }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole }>) {
  const tabs = tabsFor("sales", role), ar = locale === "ar";
  return <nav role="tablist" aria-label={ar ? "مساحة شحنة البيع" : "Sales shipment workspace"} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBlock: 8 }}>
    {tabs.map((tab, index) => <a key={tab.id} id={`${tab.id}-tab`} role="tab" aria-selected={index === 0} aria-controls={tab.id} href={`#${tab.id}`} style={{ alignItems: "center", background: index === 0 ? "var(--orb-color-primary-container)" : "var(--orb-color-surface-container)", borderRadius: 999, color: "var(--orb-color-on-surface)", display: "inline-flex", flex: "0 0 auto", padding: "8px 16px", textDecoration: "none" }}>{tab.label[locale]}</a>)}
  </nav>;
}

function ReadOnlyPanel({ title, reference, locale }: Readonly<{ title: string; reference: string; locale: WorkspaceLocale }>) {
  return <section role="region" aria-label={title} style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}><h2>{title}</h2><p><bdi>{reference}</bdi> · {locale === "ar" ? "عرض للقراءة فقط حسب الدور" : "Role-shaped read-only view"}</p><a href={`/projects/demo/overview?locale=${locale}`}>{locale === "ar" ? "عرض مصدر المشروع" : "View Project source"}</a></section>;
}
function Panel({ id, endpoint, children }: Readonly<{ id: string; endpoint: string; children: React.ReactNode }>) {
  return <section id={id} role="tabpanel" aria-labelledby={`${id}-tab`} data-backend-endpoint={endpoint} style={panelStyle}>{children}</section>;
}

export function SalesShipmentWorkspace({ locale, role, state = "confirmed" }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole; state?: ShipmentUiState }>) {
  const readOnly = role === "finance-viewer", ar = locale === "ar";
  return <article data-complete-shipment-workspace="sales" style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>ORB-SAL-0007</bdi></p><h1>{ar ? "مساحة شحنة البيع" : "Sales shipment workspace"}</h1><p>{ar ? "نقطة تكامل ثابتة لكل مرحلة تشغيلية." : "Stable composition point for every operational stage."}</p></header>
    <TabList locale={locale} role={role} />
    <Panel id="sales-dataset" endpoint="/api/sales-shipments/demo">{readOnly ? <ReadOnlyPanel title={ar ? "مجموعة البيانات" : "Dataset"} reference="ORB-SAL-0007 · Version 7" locale={locale} /> : <ShipmentWorkspaceCore kind="sales" locale={locale} state={state} demoState={null} />}</Panel>
    <Panel id="sales-route" endpoint="/api/sales-shipments/demo/route-checklist">{readOnly ? <ReadOnlyPanel title={ar ? "قائمة المسار" : "Route checklist"} reference="Template 1 · Version 3" locale={locale} /> : <RouteChecklist locale={locale} checklist={checklist} />}</Panel>
    <Panel id="sales-evidence" endpoint="/api/evidence">{readOnly ? <ReadOnlyPanel title={ar ? "الدليل" : "Evidence"} reference="EVIDENCE-ROUTE-0007" locale={locale} /> : <EvidenceUploader locale={locale} subjectId="demo" />}</Panel>
    <Panel id="sales-documents" endpoint="/api/sales-shipments/demo/documents">{readOnly ? <ReadOnlyPanel title={ar ? "المستندات" : "Documents"} reference="DOC-0007-R2" locale={locale} /> : <SalesShipmentDocumentsPanel locale={locale} />}</Panel>
    <Panel id="sales-settlement" endpoint="/api/projects/demo/profit">{readOnly ? <ReadOnlyPanel title={ar ? "التسوية" : "Settlement"} reference="USD 6,000.00 balance" locale={locale} /> : <SalesShipmentSettlementPanel locale={locale} />}</Panel>
    <Panel id="sales-expense" endpoint="/api/projects/demo/expenses">{readOnly ? <ReadOnlyPanel title={ar ? "المصروف" : "Expense"} reference="EXP-0007" locale={locale} /> : <SalesShipmentExpensePanel locale={locale} />}</Panel>
    <Panel id="sales-claims" endpoint="/api/projects/demo/claims">{readOnly ? <ReadOnlyPanel title={ar ? "المطالبات" : "Claims"} reference="CLAIM-0007" locale={locale} /> : <SalesShipmentClaimsPanel locale={locale} />}</Panel>
    <Panel id="sales-closure" endpoint="/api/projects/demo/closure-assessment">{readOnly ? <ReadOnlyPanel title={ar ? "الإغلاق" : "Closure"} reference="ASSESSMENT-0014" locale={locale} /> : <SalesShipmentClosurePanel locale={locale} />}</Panel>
  </article>;
}
