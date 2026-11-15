import styles from "./AccountsHubPage.module.css";
import type { AccountsLocale } from "./accounts-hub";
import { buildAccountDestinations } from "./accounts-hub";

// Static fixture data sourced from each account sub-page
const recentRecords = [
  { id: "019a5f9b-7c00-7000-8000-000000001102", type: "Supplier invoice", reference: "PINV-2026-044", projectId: "project-2", occurredOn: "2026-11-12", currency: "AED", amount: "39000.000000" },
  { id: "019a5f9b-7c00-7000-8000-000000001204", type: "Supplier payment", reference: "PAY-2026-044", projectId: "project-2", occurredOn: "2026-11-12", currency: "AED", amount: "30000.000000" },
  { id: "expense-2", type: "Expense", reference: "EXP-2026-022", projectId: "project-2", occurredOn: "2026-11-12", currency: "AED", amount: "3200.000000" },
  { id: "019a5f9b-7c00-7000-8000-000000001203", type: "Collection", reference: "COL-2026-014", projectId: "project-1", occurredOn: "2026-11-11", currency: "USD", amount: "20000.000000" },
] as const;

const currencies = [
  { code: "USD", label: "USD" },
  { code: "AED", label: "AED" },
] as const;

const copy = {
  en: {
    eyebrow: "Operational accounts",
    title: "Accounts hub",
    summaryLabel: "Accounts summary by currency",
    sectionsLabel: "Accounts sections",
    recentTitle: "Recent transactions",
    tableHeaders: ["Reference", "Type", "Project", "Date", "Amount"],
  },
  ar: {
    eyebrow: "الحسابات التشغيلية",
    title: "مركز الحسابات",
    summaryLabel: "ملخص الحسابات حسب العملة",
    sectionsLabel: "أقسام الحسابات",
    recentTitle: "آخر المعاملات",
    tableHeaders: ["المرجع", "النوع", "المشروع", "التاريخ", "المبلغ"],
  },
} as const;

export function AccountsHubPage({ locale, role }: { readonly locale: AccountsLocale; readonly role?: string }) {
  const ar = locale === "ar";
  const text = copy[locale];
  const destinations = buildAccountDestinations(locale);

  return (
    <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h1 id="accounts-title">{text.title}</h1>
        </div>
        <a className={styles.backLink} href={`/accounts?locale=${locale}`}>{ar ? "مركز الحسابات" : "Accounts hub"}</a>
      </header>

      <section aria-label={text.summaryLabel}>
        {currencies.map((currency) => (
          <div key={currency.code} className={styles.card}>
            <h2>{currency.label}</h2>
          </div>
        ))}
      </section>

      <nav aria-label={text.sectionsLabel}>
        {destinations.map((dest) => (
          <a key={dest.key} href={dest.href}>{dest.label}</a>
        ))}
      </nav>

      <section aria-labelledby="accounts-recent-title">
        <h2 id="accounts-recent-title">{text.recentTitle}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {text.tableHeaders.map((header) => <th key={header}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {recentRecords.map((record) => (
                <tr key={record.id}>
                  <td><bdi>{record.reference}</bdi></td>
                  <td>{record.type}</td>
                  <td><a href={`/projects/${record.projectId}/overview?locale=${locale}`}><bdi>{record.projectId}</bdi></a></td>
                  <td><bdi>{record.occurredOn}</bdi></td>
                  <td className={styles.amount}><bdi>{record.currency} {record.amount}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
