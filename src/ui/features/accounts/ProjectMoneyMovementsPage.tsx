import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import styles from "./AccountsHubPage.module.css";
import type { AccountsLocale } from "./accounts-hub";
import { filterProjectMoneyMovements, type MoneyMovementListItem, type MoneyMovementType } from "./project-money-movements";

const movements: readonly MoneyMovementListItem[] = Object.freeze([
  { id: "collection-1", projectId: "project-1", partyId: "customer-1", type: "COLLECTION", occurredOn: "2026-11-11", state: "POSTED", reference: "COL-2026-014", currency: "USD", amount: "20000.000000" },
  { id: "collection-2", projectId: "project-2", partyId: "customer-2", type: "COLLECTION", occurredOn: "2026-11-09", state: "POSTED", reference: "COL-2026-009", currency: "AED", amount: "45000.000000" },
  { id: "supplier-payment-1", projectId: "project-1", partyId: "supplier-1", type: "SUPPLIER_PAYMENT", occurredOn: "2026-11-10", state: "POSTED", reference: "PAY-2026-031", currency: "USD", amount: "12500.000000" },
  { id: "supplier-payment-2", projectId: "project-2", partyId: "supplier-2", type: "SUPPLIER_PAYMENT", occurredOn: "2026-11-12", state: "POSTED", reference: "PAY-2026-044", currency: "AED", amount: "30000.000000" },
  { id: "collection-void", projectId: "project-1", partyId: "customer-1", type: "COLLECTION", occurredOn: "2026-11-13", state: "REVERSED", reference: "COL-2026-VOID", currency: "USD", amount: "500.000000" },
]);

const copy = {
  en: {
    COLLECTION: { title: "Collections", eyebrow: "Customer money movements", register: "Collection register", party: "Customer", empty: "No active collections exist for this project.", project: "Customer receipts for this project, linked to the paying customer." },
    SUPPLIER_PAYMENT: { title: "Supplier payments", eyebrow: "Supplier money movements", register: "Payment register", party: "Supplier", empty: "No active supplier payments exist for this project.", project: "Supplier payments for this project, attributable to the paid supplier." },
  },
  ar: {
    COLLECTION: { title: "التحصيلات", eyebrow: "حركات أموال العملاء", register: "سجل التحصيلات", party: "العميل", empty: "لا توجد تحصيلات نشطة لهذا المشروع.", project: "متحصلات العملاء لهذا المشروع، مرتبطة بالعميل الدافع." },
    SUPPLIER_PAYMENT: { title: "دفعات الموردين", eyebrow: "حركات أموال الموردين", register: "سجل الدفعات", party: "المورد", empty: "لا توجد دفعات موردين نشطة لهذا المشروع.", project: "دفعات الموردين لهذا المشروع، منسوبة إلى المورد المدفوع له." },
  },
} as const;

export function ProjectMoneyMovementsPage({ locale, projectId, type }: { readonly locale: AccountsLocale; readonly projectId?: string; readonly type: MoneyMovementType }) {
  const ar = locale === "ar", text = copy[locale][type];
  const items = projectId ? filterProjectMoneyMovements(movements, projectId, type) : movements.filter((item) => item.type === type && item.state !== "CANCELLED" && item.state !== "REVERSED");
  const partyPath = type === "COLLECTION" ? "customers" : "suppliers";
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="money-movements-title">
    {projectId ? <ProjectContextNavigation locale={locale} projectId={projectId} current="accounts" /> : null}
    <header className={styles.header}><div><p className={styles.eyebrow}>{text.eyebrow}</p><h1 id="money-movements-title">{text.title}</h1><p className={styles.subtitle}>{projectId ? <>{text.project} <bdi>{projectId}</bdi></> : (ar ? `${text.title} عبر جميع المشاريع، مع الحفاظ على عملة المصدر ونسبة الطرف.` : `${text.title} across every project, preserving source currency and party attribution.`)}</p></div><a className={styles.backLink} href={`/accounts?locale=${locale}`}>{ar ? "مركز الحسابات" : "Accounts hub"}</a></header>
    <section className={styles.card} aria-labelledby="money-movement-register-title"><header className={styles.cardHeader}><div><h2 id="money-movement-register-title">{text.register}</h2><p className={styles.muted}>{ar ? `${items.length} حركة نشطة` : `${items.length} active movement${items.length === 1 ? "" : "s"}`}</p></div></header>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar ? "المرجع" : "Reference"}</th><th>{text.party}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الحالة" : "Status"}</th><th className={styles.amount}>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className={styles.reference}><strong><bdi>{item.reference}</bdi></strong><span><a href={`/projects/${item.projectId}/money?locale=${locale}`}><bdi>{item.projectId}</bdi></a></span></div></td><td><a href={`/${partyPath}/${item.partyId}?locale=${locale}`}><bdi>{item.partyId}</bdi></a></td><td><bdi>{item.occurredOn}</bdi></td><td><span className={styles.state}>{item.state}</span></td><td className={styles.amount}><bdi>{item.currency} {item.amount}</bdi></td></tr>)}</tbody></table>{items.length === 0 ? <p className={styles.empty}>{text.empty}</p> : null}</div>
    </section>
  </section>;
}
