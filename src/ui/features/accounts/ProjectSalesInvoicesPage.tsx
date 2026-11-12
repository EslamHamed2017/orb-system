import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import styles from "./AccountsHubPage.module.css";
import type { AccountsLocale } from "./accounts-hub";
import { FinancialAttachmentPanel } from "../evidence/FinancialAttachmentPanel";
import { filterProjectSalesInvoices, type SalesInvoiceListItem } from "./project-sales-invoices";

const invoices: readonly SalesInvoiceListItem[] = Object.freeze([
  { id: "019a5f9b-7c00-7000-8000-000000001001", projectId: "project-1", shipmentId: "sales-shipment-1", occurredOn: "2026-11-11", state: "ISSUED", reference: "SINV-2026-014", currency: "USD", amount: "28500.000000", outstandingAmount: "8500.000000" },
  { id: "019a5f9b-7c00-7000-8000-000000001002", projectId: "project-2", shipmentId: "sales-shipment-2", occurredOn: "2026-11-09", state: "PARTIALLY_PAID", reference: "SINV-2026-013", currency: "AED", amount: "45000.000000", outstandingAmount: "12000.000000" },
  { id: "019a5f9b-7c00-7000-8000-000000001003", projectId: "project-1", shipmentId: "sales-shipment-void", occurredOn: "2026-11-12", state: "CANCELLED", reference: "SINV-2026-VOID", currency: "USD", amount: "1000.000000", outstandingAmount: "1000.000000" },
]);

export function ProjectSalesInvoicesPage({ locale, projectId, canUpload }: { readonly locale: AccountsLocale; readonly projectId?: string; readonly canUpload: boolean }) {
  const ar = locale === "ar";
  const items = projectId ? filterProjectSalesInvoices(invoices, projectId) : invoices.filter((invoice) => invoice.state !== "CANCELLED" && invoice.state !== "REVERSED");
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="sales-invoices-title">
    {projectId ? <ProjectContextNavigation locale={locale} projectId={projectId} current="accounts" /> : null}
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "الحسابات التشغيلية" : "Operational accounts"}</p><h1 id="sales-invoices-title">{ar ? "فواتير المبيعات" : "Sales invoices"}</h1><p className={styles.subtitle}>{projectId ? (ar ? <>فواتير العملاء للمشروع <bdi>{projectId}</bdi>، فاتورة واحدة فعالة لكل شحنة بيع.</> : <>Customer invoices for project <bdi>{projectId}</bdi>, with one active invoice per sales shipment.</>) : (ar ? "فواتير العملاء عبر جميع المشاريع، مجمعة حسب شحنة البيع." : "Customer invoices across every project, grouped by sales shipment.")}</p></div><a className={styles.backLink} href={`/accounts?locale=${locale}`}>{ar ? "مركز الحسابات" : "Accounts hub"}</a></header>
    <section className={styles.card} aria-labelledby="sales-invoice-register-title"><header className={styles.cardHeader}><div><h2 id="sales-invoice-register-title">{ar ? "سجل الفواتير" : "Invoice register"}</h2><p className={styles.muted}>{ar ? `${items.length} فاتورة نشطة` : `${items.length} active invoice${items.length === 1 ? "" : "s"}`}</p></div></header>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar ? "المرجع" : "Reference"}</th><th>{ar ? "شحنة البيع" : "Sales shipment"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الحالة" : "Status"}</th><th className={styles.amount}>{ar ? "الإجمالي" : "Total"}</th><th className={styles.amount}>{ar ? "المتبقي" : "Outstanding"}</th></tr></thead><tbody>{items.map((invoice) => <tr key={invoice.id}><td><div className={styles.reference}><strong><bdi>{invoice.reference}</bdi></strong><span><a href={`/projects/${invoice.projectId}/overview?locale=${locale}`}><bdi>{invoice.projectId}</bdi></a></span></div></td><td><a href={`/sales-shipments/${invoice.shipmentId}?locale=${locale}`}><bdi>{invoice.shipmentId}</bdi></a></td><td><bdi>{invoice.occurredOn}</bdi></td><td><span className={styles.state}>{invoice.state}</span></td><td className={styles.amount}><bdi>{invoice.currency} {invoice.amount}</bdi></td><td className={styles.amount}><bdi>{invoice.currency} {invoice.outstandingAmount}</bdi></td></tr>)}</tbody></table>{items.length === 0 ? <p className={styles.empty}>{ar ? "لا توجد فواتير مبيعات نشطة لهذا المشروع." : "No active sales invoices exist for this project."}</p> : null}</div>
    </section>
    {items.map((invoice) => <FinancialAttachmentPanel key={invoice.id} locale={locale} projectId={invoice.projectId} subjectType="SALES_INVOICE" subjectId={invoice.id} canUpload={canUpload} />)}
  </section>;
}
