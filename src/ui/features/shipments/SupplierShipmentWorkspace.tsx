import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { SupplierShipmentInvoicePaymentPanel } from "../invoices/SupplierShipmentInvoicePaymentPanel";
import { SupplierShipmentStatementPanel } from "../statements/SupplierShipmentStatementPanel";
import { ShipmentWorkspaceCore } from "./ShipmentWorkspaceCore";
import type { ShipmentUiState } from "./ExecutionActions";
import { tabsFor, type WorkspaceLocale, type WorkspaceRole } from "./workspace-tabs";
import s from "./operations.module.css";

const panelStyle = { display: "grid", gap: 16, scrollMarginBlockStart: 80 } as const;
function TabList({ locale, role }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole }>) {
  const tabs = tabsFor("supplier", role), ar = locale === "ar";
  return <nav role="tablist" aria-label={ar ? "مساحة شحنة المورد" : "Supplier shipment workspace"} className={s.tabs}>
    {tabs.map((tab, index) => <a key={tab.id} id={`${tab.id}-tab`} role="tab" aria-selected={index === 0} aria-controls={tab.id} href={`#${tab.id}`} className={`${s.tab} ${index === 0 ? s.tabActive : ""}`}>{tab.label[locale]}</a>)}
  </nav>;
}
function ReadOnlyPanel({ title, reference, locale }: Readonly<{ title: string; reference: string; locale: WorkspaceLocale }>) {
  return <section role="region" aria-label={title} className={`${s.cardMuted} ${s.readOnly}`}><h2>{title}</h2><p><bdi>{reference}</bdi> · {locale === "ar" ? "عرض للقراءة فقط حسب الدور" : "Role-shaped read-only view"}</p><a href={`/projects/demo/overview?locale=${locale}`}>{locale === "ar" ? "عرض مصدر المشروع" : "View Project source"}</a></section>;
}
function Panel({ id, endpoint, children }: Readonly<{ id: string; endpoint: string; children: React.ReactNode }>) {
  return <section id={id} role="tabpanel" aria-labelledby={`${id}-tab`} data-backend-endpoint={endpoint} style={panelStyle}>{children}</section>;
}
export function SupplierShipmentWorkspace({ locale, role, state = "confirmed" }: Readonly<{ locale: WorkspaceLocale; role: WorkspaceRole; state?: ShipmentUiState }>) {
  const readOnly = role === "finance-viewer", ar = locale === "ar";
  return <article data-complete-shipment-workspace="supplier" className={s.page}>
 <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(ar ? "rtl" : "ltr")}` }} />
    <header className={s.pageHeader}><div><p className={s.eyebrow}>{ar ? "تنفيذ شحنة المورد" : "Supplier execution"}</p><h1>{ar ? "مساحة شحنة المورد" : "Supplier shipment workspace"}</h1><p>{ar ? "مجموعة البيانات والدليل والفاتورة والدفع والبيان في مساحة تشغيل واحدة." : "Dataset, evidence, invoice, payment, and statement in one operational workspace."}</p></div><span className={`${s.chip} ${s.warning}`}>{state.toUpperCase()}</span></header><div className={s.contextBar}><div className={s.contextItem}><span>{ar ? "المرجع" : "Reference"}</span><strong><bdi>ORB-SUP-0007</bdi></strong></div><div className={s.contextItem}><span>{ar ? "المشروع" : "Project"}</span><strong><bdi>ORB-PROJ-DEMO</bdi></strong></div><div className={s.contextItem}><span>{ar ? "الإصدار" : "Version"}</span><strong>7</strong></div></div>
    <TabList locale={locale} role={role} />
    <Panel id="supplier-dataset" endpoint="/api/supplier-shipments/demo">{readOnly ? <ReadOnlyPanel title={ar ? "مجموعة البيانات والإجراءات" : "Dataset & actions"} reference="ORB-SUP-0007 · Version 7" locale={locale} /> : <ShipmentWorkspaceCore kind="supplier" locale={locale} state={state} demoState={null} />}</Panel>
    <Panel id="supplier-evidence" endpoint="/api/evidence">{readOnly ? <ReadOnlyPanel title={ar ? "الدليل" : "Evidence"} reference="EVIDENCE-SUPPLIER-0007" locale={locale} /> : <EvidenceUploader locale={locale} subjectId="demo" />}</Panel>
    <Panel id="supplier-invoice-payment" endpoint="/api/supplier-shipments/demo/invoices"><SupplierShipmentInvoicePaymentPanel locale={locale} /></Panel>
    <Panel id="supplier-statement" endpoint="/api/statements/supplier-shipment/demo"><SupplierShipmentStatementPanel locale={locale} /></Panel>
  </article>;
}
