import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { SupplierShipmentInvoicePaymentPanel } from "../invoices/SupplierShipmentInvoicePaymentPanel";
import { SupplierShipmentStatementPanel } from "../statements/SupplierShipmentStatementPanel";
import { ShipmentWorkspaceCore } from "./ShipmentWorkspaceCore";
import type { ShipmentUiState } from "./ExecutionActions";
import { tabsFor, type WorkspaceLocale, type WorkspaceRole } from "./workspace-tabs";

const panelStyle = { display: "grid", gap: 16, scrollMarginBlockStart: 80 } as const;
function TabList({ locale, role }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole }>) {
  const tabs = tabsFor("supplier", role), ar = locale === "ar";
  return <nav role="tablist" aria-label={ar ? "مساحة شحنة المورد" : "Supplier shipment workspace"} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBlock: 8 }}>
    {tabs.map((tab, index) => <a key={tab.id} id={`${tab.id}-tab`} role="tab" aria-selected={index === 0} aria-controls={tab.id} href={`#${tab.id}`} style={{ alignItems: "center", background: index === 0 ? "var(--orb-color-primary-container)" : "var(--orb-color-surface-container)", borderRadius: 999, color: "var(--orb-color-on-surface)", display: "inline-flex", flex: "0 0 auto", padding: "8px 16px", textDecoration: "none" }}>{tab.label[locale]}</a>)}
  </nav>;
}
function ReadOnlyPanel({ title, reference, locale }: Readonly<{ title: string; reference: string; locale: WorkspaceLocale }>) {
  return <section role="region" aria-label={title} style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}><h2>{title}</h2><p><bdi>{reference}</bdi> · {locale === "ar" ? "عرض للقراءة فقط حسب الدور" : "Role-shaped read-only view"}</p><a href={`/projects/demo/overview?locale=${locale}`}>{locale === "ar" ? "عرض مصدر المشروع" : "View Project source"}</a></section>;
}
function Panel({ id, endpoint, children }: Readonly<{ id: string; endpoint: string; children: React.ReactNode }>) {
  return <section id={id} role="tabpanel" aria-labelledby={`${id}-tab`} data-backend-endpoint={endpoint} style={panelStyle}>{children}</section>;
}
export function SupplierShipmentWorkspace({ locale, role, state = "confirmed" }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole; state?: ShipmentUiState }>) {
  const readOnly = role === "finance-viewer", ar = locale === "ar";
  return <article data-complete-shipment-workspace="supplier" style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <header><p><bdi>ORB-SUP-0007</bdi></p><h1>{ar ? "مساحة شحنة المورد" : "Supplier shipment workspace"}</h1><p>{ar ? "مجموعة البيانات والدليل والفاتورة والدفع والبيان في نقطة تكامل ثابتة." : "Dataset, evidence, invoice, payment and statement at one stable composition point."}</p></header>
    <TabList locale={locale} role={role} />
    <Panel id="supplier-dataset" endpoint="/api/supplier-shipments/demo">{readOnly ? <ReadOnlyPanel title={ar ? "مجموعة البيانات والإجراءات" : "Dataset & actions"} reference="ORB-SUP-0007 · Version 7" locale={locale} /> : <ShipmentWorkspaceCore kind="supplier" locale={locale} state={state} demoState={null} />}</Panel>
    <Panel id="supplier-evidence" endpoint="/api/evidence">{readOnly ? <ReadOnlyPanel title={ar ? "الدليل" : "Evidence"} reference="EVIDENCE-SUPPLIER-0007" locale={locale} /> : <EvidenceUploader locale={locale} subjectId="demo" />}</Panel>
    <Panel id="supplier-invoice-payment" endpoint="/api/supplier-shipments/demo/invoices"><SupplierShipmentInvoicePaymentPanel locale={locale} /></Panel>
    <Panel id="supplier-statement" endpoint="/api/statements/supplier-shipment/demo"><SupplierShipmentStatementPanel locale={locale} /></Panel>
  </article>;
}
