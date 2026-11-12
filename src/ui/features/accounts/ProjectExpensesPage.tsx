import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { PilotTransactionAttachmentPanel } from "../evidence/PilotTransactionAttachmentPanel";
import styles from "./AccountsHubPage.module.css";
import type { AccountsLocale } from "./accounts-hub";
import { filterProjectExpenses, type ExpenseListItem } from "./project-expenses";
import { OperationalTransactionPrintDocument } from "./OperationalTransactionPrintDocument";

const expenses: readonly ExpenseListItem[] = Object.freeze([
  { id: "expense-1", projectId: "project-1", scopeType: "SALES_SHIPMENT", scopeId: "sales-shipment-1", occurredOn: "2026-11-11", state: "APPROVED", reference: "EXP-2026-018", category: "FREIGHT", currency: "USD", amount: "1250.000000" },
  { id: "expense-2", projectId: "project-2", scopeType: "PROJECT", occurredOn: "2026-11-12", state: "APPROVED", reference: "EXP-2026-022", category: "INSURANCE", currency: "AED", amount: "3200.000000" },
  { id: "expense-void", projectId: "project-1", scopeType: "PROJECT", occurredOn: "2026-11-13", state: "CANCELLED", reference: "EXP-2026-VOID", category: "DOCUMENTATION", currency: "USD", amount: "500.000000" },
]);

function scopeHref(item: ExpenseListItem, locale: AccountsLocale): string {
  if (item.scopeType === "SALES_SHIPMENT" && item.scopeId) return `/sales-shipments/${item.scopeId}?locale=${locale}`;
  if (item.scopeType === "SUPPLIER_CONTAINER" && item.scopeId) return `/supplier-shipments/${item.scopeId}?locale=${locale}`;
  return `/projects/${item.projectId}/overview?locale=${locale}`;
}

export function ProjectExpensesPage({ locale, projectId, canUpload = true }: { readonly locale: AccountsLocale; readonly projectId?: string; readonly canUpload?: boolean }) {
  const ar = locale === "ar";
  const items = projectId ? filterProjectExpenses(expenses, projectId) : expenses.filter((expense) => expense.state !== "CANCELLED" && expense.state !== "REVERSED");
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="expenses-register-title">
    {projectId ? <ProjectContextNavigation locale={locale} projectId={projectId} current="expenses" /> : null}
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "الحسابات التشغيلية" : "Operational accounts"}</p><h1 id="expenses-register-title">{ar ? "المصروفات" : "Expenses"}</h1><p className={styles.subtitle}>{projectId ? (ar ? <>المصروفات التشغيلية للمشروع <bdi>{projectId}</bdi>، مرتبطة بنطاق المعاملة ومحتفظ بها بعملة المصدر.</> : <>Operating expenses for project <bdi>{projectId}</bdi>, linked to transaction scope and preserved in source currency.</>) : (ar ? "المصروفات التشغيلية عبر جميع المشاريع، دون محاسبة دفتر أستاذ عام." : "Operating expenses across every project, without general-ledger accounting.")}</p></div><a className={styles.backLink} href={`/accounts?locale=${locale}`}>{ar ? "مركز الحسابات" : "Accounts hub"}</a></header>
    <section className={styles.card} aria-labelledby="expense-register-heading"><header className={styles.cardHeader}><div><h2 id="expense-register-heading">{ar ? "سجل المصروفات" : "Expense register"}</h2><p className={styles.muted}>{ar ? `${items.length} مصروف نشط` : `${items.length} active expense${items.length === 1 ? "" : "s"}`}</p></div>{projectId ? <a href={`/projects/${projectId}/expenses?locale=${locale}`}>{ar ? "إدارة مصروفات المشروع" : "Manage project expenses"}</a> : null}</header>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar ? "المرجع" : "Reference"}</th><th>{ar ? "الفئة" : "Category"}</th><th>{ar ? "النطاق" : "Scope"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الحالة" : "Status"}</th><th className={styles.amount}>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className={styles.reference}><strong><bdi>{item.reference}</bdi></strong><span><a href={`/projects/${item.projectId}/expenses?locale=${locale}`}><bdi>{item.projectId}</bdi></a></span></div></td><td><bdi>{item.category}</bdi></td><td><a href={scopeHref(item, locale)}><bdi>{item.scopeId ?? item.projectId}</bdi></a></td><td><bdi>{item.occurredOn}</bdi></td><td><span className={styles.state}>{item.state}</span></td><td className={styles.amount}><bdi>{item.currency} {item.amount}</bdi></td></tr>)}</tbody></table>{items.length === 0 ? <p className={styles.empty}>{ar ? "لا توجد مصروفات نشطة لهذا المشروع." : "No active expenses exist for this project."}</p> : null}</div>
    </section>
    {items.map((item) => <OperationalTransactionPrintDocument key={`print-${item.id}`} locale={locale} kind="expense" reference={item.reference} projectId={item.projectId} occurredOn={item.occurredOn} state={item.state} currency={item.currency} amount={item.amount} category={item.category} scopeReference={item.scopeId ?? item.projectId} />)}
    {items.map((item) => <PilotTransactionAttachmentPanel key={`expense-attachments-${item.id}`} locale={locale} projectId={item.projectId} subjectType="EXPENSE" subjectId={item.id} canUpload={canUpload} />)}
  </section>;
}
