import styles from "./AccountsHubPage.module.css";
import type { AccountsLocale, AccountHubRecord } from "./accounts-hub";
import { accountRecordHref, buildAccountDestinations, selectRecentAccountRecords } from "./accounts-hub";

const copy = {
  en: {
    eyebrow: "Operational accounts", title: "Accounts hub", summaryLabel: "Persisted sales invoice activity by currency",
    sectionsLabel: "Available persisted accounts sections", recentTitle: "Recent persisted sales invoices",
    tableHeaders: ["Reference", "Type", "Project", "Date", "Amount"], empty: "No persisted account activity is available.", unavailable: "The accounts database is unavailable; no sample records are shown.", invoice: "Sales invoice", records: "records",
  },
  ar: {
    eyebrow: "الحسابات التشغيلية", title: "مركز الحسابات", summaryLabel: "نشاط فواتير المبيعات المحفوظ حسب العملة",
    sectionsLabel: "أقسام الحسابات المحفوظة المتاحة", recentTitle: "آخر فواتير المبيعات المحفوظة",
    tableHeaders: ["المرجع", "النوع", "المشروع", "التاريخ", "المبلغ"], empty: "لا توجد حركة حسابات محفوظة متاحة.", unavailable: "قاعدة بيانات الحسابات غير متاحة؛ لم يتم عرض أي سجلات تجريبية.", invoice: "فاتورة مبيعات", records: "سجلات",
  },
} as const;

export function AccountsHubPage({ locale, records, databaseAvailable = true }: { readonly locale: AccountsLocale; readonly records: readonly AccountHubRecord[]; readonly databaseAvailable?: boolean }) {
  const ar = locale === "ar";
  const text = copy[locale];
  const destinations = buildAccountDestinations(locale).filter((destination) => destination.key === "salesInvoices");
  const activeRecords = selectRecentAccountRecords(records, records.length);
  const recentRecords = selectRecentAccountRecords(records);
  const currencyCounts = [...new Set(activeRecords.map((record) => record.currency))].map((currency) => ({ currency, count: activeRecords.filter((record) => record.currency === currency).length }));
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{text.eyebrow}</p><h1 id="accounts-title">{text.title}</h1></div></header>
    {currencyCounts.length > 0 ? <section aria-label={text.summaryLabel}>{currencyCounts.map(({ currency, count }) => <div key={currency} className={styles.card}><h2><bdi>{currency}</bdi></h2><p className={styles.muted}>{count} {text.records}</p></div>)}</section> : null}
    <nav className={styles.destinationGrid} aria-label={text.sectionsLabel}>{destinations.map((destination) => <a className={styles.destinationCard} key={destination.key} href={destination.href}><strong>{destination.label}</strong><span>{destination.description}</span></a>)}</nav>
    <section aria-labelledby="accounts-recent-title"><h2 id="accounts-recent-title">{text.recentTitle}</h2>
      {!databaseAvailable ? <p role="status" className={styles.empty}>{text.unavailable}</p> : recentRecords.length === 0 ? <p role="status" className={styles.empty}>{text.empty}</p> :
      <div className={styles.tableWrap} tabIndex={0}><table className={styles.table}><thead><tr>{text.tableHeaders.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>
        {recentRecords.map((record) => <tr key={record.id}><td><a href={accountRecordHref(record.type, locale)}><bdi>{record.reference}</bdi></a></td><td>{record.type === "SALES_INVOICE" ? text.invoice : record.type}</td><td><a href={`/projects/${record.projectId}/overview?locale=${locale}`}><bdi>{record.projectId}</bdi></a></td><td><bdi>{record.occurredOn}</bdi></td><td className={styles.amount}><bdi>{record.currency} {record.amount}</bdi></td></tr>)}
      </tbody></table></div>}
    </section>
  </section>;
}
