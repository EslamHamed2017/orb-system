import styles from "./AccountsHubPage.module.css";
import { accountRecordHref, buildAccountDestinations, selectRecentAccountRecords, type AccountHubRecord, type AccountsLocale } from "./accounts-hub";

const summaries = Object.freeze([
  { currency: "AED", salesInvoiced: "185,000.000000", salesOutstanding: "35,000.000000", supplierOutstanding: "42,000.000000", netOperationalCash: "18,500.000000" },
  { currency: "USD", salesInvoiced: "96,500.000000", salesOutstanding: "21,500.000000", supplierOutstanding: "30,200.000000", netOperationalCash: "12,800.000000" },
]);
const records: readonly AccountHubRecord[] = Object.freeze([
  { id:"sales-invoice-1",projectId:"project-1",type:"SALES_INVOICE",occurredOn:"2026-11-11",state:"ISSUED",reference:"SINV-2026-014",currency:"USD",amount:"28500.000000",outstandingAmount:"8500.000000" },
  { id:"supplier-invoice-1",projectId:"project-1",type:"SUPPLIER_INVOICE",occurredOn:"2026-11-10",state:"CONFIRMED",reference:"PINV-2026-031",currency:"USD",amount:"17700.000000",outstandingAmount:"5200.000000" },
  { id:"collection-1",projectId:"project-2",type:"COLLECTION",occurredOn:"2026-11-09",state:"POSTED",reference:"COL-2026-009",currency:"AED",amount:"45000.000000",outstandingAmount:"0.000000" },
  { id:"expense-1",projectId:"project-2",type:"EXPENSE",occurredOn:"2026-11-08",state:"APPROVED",reference:"EXP-2026-022",currency:"AED",amount:"3200.000000",outstandingAmount:"0.000000" },
]);
const typeLabels = {
  en: { SALES_INVOICE:"Customer Commercial Invoice", SUPPLIER_INVOICE:"Supplier Commercial Invoice", COLLECTION:"Collection", SUPPLIER_PAYMENT:"Supplier payment", EXPENSE:"Expense" },
  ar: { SALES_INVOICE:"الفاتورة التجارية للعميل", SUPPLIER_INVOICE:"الفاتورة التجارية للمورد", COLLECTION:"تحصيل", SUPPLIER_PAYMENT:"دفعة مورد", EXPENSE:"مصروف" },
} as const;

export function AccountsHubPage({ locale }: { readonly locale: AccountsLocale }) {
  const ar = locale === "ar", destinations = buildAccountDestinations(locale), recent = selectRecentAccountRecords(records);
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "التجارة والعمليات" : "Trade and operations"}</p><h1 id="accounts-title">{ar ? "مركز الحسابات" : "Accounts hub"}</h1><p className={styles.subtitle}>{ar ? "تتبع تجاري تشغيلي للفواتير والتحصيلات ودفعات الموردين والمصروفات عبر جميع المشاريع.":"Operational commercial tracking for invoices, collections, supplier payments and expenses across every project."}</p></div><p className={styles.notice}>{ar ? "لا دفتر أستاذ عام ولا تقييم مخزون" : "No general ledger or inventory valuation"}</p></header>
    <div className={styles.summary} aria-label={ar ? "ملخص الحسابات حسب العملة" : "Accounts summary by currency"}>{summaries.map((summary)=><section className={styles.currency} key={summary.currency}><header className={styles.currencyHeader}><h2><bdi>{summary.currency}</bdi></h2><span>{ar ? "إجماليات مستقلة" : "Independent totals"}</span></header><div className={styles.metrics}><Metric label={ar?"الفواتير التجارية للعملاء":"Customer Commercial Invoiced"} currency={summary.currency} value={summary.salesInvoiced}/><Metric label={ar?"مستحقات العملاء":"Customer outstanding"} currency={summary.currency} value={summary.salesOutstanding}/><Metric label={ar?"مستحقات الموردين":"Supplier outstanding"} currency={summary.currency} value={summary.supplierOutstanding}/><Metric label={ar?"صافي النقد التشغيلي":"Net operational cash"} currency={summary.currency} value={summary.netOperationalCash}/></div></section>)}</div>
    <nav className={styles.destinations} aria-label={ar ? "أقسام الحسابات" : "Accounts sections"}>{destinations.map((item)=><a className={styles.destination} href={item.href} key={item.key}><strong>{item.label}</strong><span>{item.description}</span><span aria-hidden="true">{ar ? "←" : "→"}</span></a>)}</nav>
    <section className={styles.card} aria-labelledby="recent-accounts-title"><header className={styles.cardHeader}><div><h2 id="recent-accounts-title">{ar ? "أحدث الحركات" : "Recent activity"}</h2><p className={styles.muted}>{ar ? "كل مبلغ معروض بعملته الأصلية ومرتبط بمشروعه.":"Every amount stays in its source currency and links back to its project."}</p></div><a href={`/accounts/sales-invoices?locale=${locale}`}>{ar ? "عرض السجلات" : "View records"}</a></header><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar?"المرجع":"Reference"}</th><th>{ar?"النوع":"Type"}</th><th>{ar?"التاريخ":"Date"}</th><th>{ar?"الحالة":"Status"}</th><th className={styles.amount}>{ar?"المبلغ":"Amount"}</th></tr></thead><tbody>{recent.map((record)=><tr key={record.id}><td><div className={styles.reference}><a href={accountRecordHref(record.type, locale)}><bdi>{record.reference}</bdi></a><span><a href={`/projects/${record.projectId}/overview?locale=${locale}`}><bdi>{record.projectId}</bdi></a></span></div></td><td>{typeLabels[locale][record.type]}</td><td><bdi>{record.occurredOn}</bdi></td><td><span className={styles.state}>{record.state}</span></td><td className={styles.amount}><bdi>{record.currency} {record.amount}</bdi></td></tr>)}</tbody></table></div></section>
  </section>;
}
function Metric({ label, currency, value }: { readonly label: string; readonly currency: string; readonly value: string }) { return <div className={styles.metric}><span>{label}</span><strong><bdi>{currency} {value}</bdi></strong></div>; }
