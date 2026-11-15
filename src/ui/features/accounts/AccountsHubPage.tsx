"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  customerReceivableSummary,
  parseProjectRecords,
  PROJECT_STORAGE_KEY,
  projectExpenseSummary,
  projectNextAction,
  projectStatusLabel,
  type ProjectRecord,
} from "../../../modules/projects/daily-projects";
import styles from "./AccountsHubPage.module.css";

type Locale = "en" | "ar";
type LoadState = "loading" | "ready" | "error";

export function AccountsHubPage({ locale }: { readonly locale: Locale }) {
  const ar = locale === "ar";
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    try {
      setProjects(parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-title">
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{ar ? "مساحة العمل اليومية" : "Daily workspace"}</p>
        <h1 id="accounts-title">{ar ? "العمل المالي" : "Finance work"}</h1>
        <p className={styles.subtitle}>{ar ? "اختر مشروعاً محفوظاً ثم افتح مهمة مالية واحدة واضحة.":"Choose a saved project, then open one focused finance task."}</p>
      </div>
      <p className={styles.notice}>{ar ? "تشغيل تجاري فقط — بلا دفتر أستاذ عام أو تقييم مخزون" : "Trade operations only — no general ledger or inventory valuation"}</p>
    </header>

    <p className={styles.truthNote}>{ar ? "تأتي الحالات والمبالغ أدناه فقط من السجلات التي أدخلتها وحفظتها في هذا المتصفح. لا تتم مزامنتها أو نسخها احتياطياً." : "Statuses and amounts below come only from records you entered and saved in this browser. They are not synchronized or backed up."}</p>

    {state === "loading" ? <section className={styles.stateCard} role="status">{ar ? "جارٍ تحميل العمل المالي…" : "Loading finance work…"}</section> : null}
    {state === "error" ? <section className={styles.stateCard} role="alert"><h2>{ar ? "تعذر فتح العمل المالي" : "Finance work could not be opened"}</h2><p>{ar ? "تحقق من سماح المتصفح بالتخزين المحلي ثم أعد تحميل الصفحة.":"Allow browser storage, then reload this page."}</p><button className={styles.retryAction} type="button" onClick={() => location.reload()}>{ar ? "إعادة المحاولة" : "Try again"}</button></section> : null}
    {state === "ready" && projects.length === 0 ? <section className={styles.stateCard}>
      <h2>{ar ? "لا يوجد عمل مالي للمشاريع بعد" : "No project finance work yet"}</h2>
      <p>{ar ? "أنشئ مشروعاً من بياناتك لبدء تسجيل الفواتير والدفعات والتحصيلات والمصروفات. لن نعرض مبالغ تجريبية.":"Create a project from your own data to start recording invoices, payments, collections, and expenses. No placeholder amounts will be shown."}</p>
      <a className={styles.primaryAction} href={`/projects/new?locale=${locale}`}>{ar ? "إنشاء مشروع" : "Create a project"}</a>
    </section> : null}
    {state === "ready" && projects.length > 0 ? <section aria-labelledby="project-finance-title">
      <div className={styles.sectionHeading}><div><h2 id="project-finance-title">{ar ? "المشاريع المحفوظة" : "Saved projects"}</h2><p>{projectCount(projects.length, locale)}</p></div><a href={`/projects?locale=${locale}`}>{ar ? "عرض كل المشاريع" : "View all projects"}</a></div>
      <div className={styles.projectGrid}>{projects.map((project) => <ProjectFinanceCard key={project.id} project={project} locale={locale} />)}</div>
    </section> : null}
  </section>;
}

function ProjectFinanceCard({ project, locale }: { readonly project: ProjectRecord; readonly locale: Locale }) {
  const ar = locale === "ar";
  const receivable = customerReceivableSummary(project);
  const expenses = projectExpenseSummary(project);
  const nextAction = projectNextAction(project, locale);
  const closed = project.status === "CLOSED";
  const supplierReady = project.status === "ACTIVE" && Boolean(project.customerShipmentReviewedAt);
  const customerReady = project.status === "ACTIVE" && Boolean(project.supplierPayment);
  const expensesReady = project.status === "ACTIVE";
  const supplierState = project.supplierPayment ? (ar ? "تم تسجيل الفاتورة والدفعة" : "Invoice and payment recorded") : project.supplierInvoice ? (ar ? "الفاتورة محفوظة؛ الدفعة مطلوبة" : "Invoice saved; payment needed") : (ar ? "لم تبدأ" : "Not started");
  const customerState = project.customerInvoice ? receivable.complete ? (ar ? "تم تسجيل التحصيل بالكامل" : "Collection recorded in full") : (ar ? `${receivable.remaining} ${project.currency} متبقية` : `${receivable.remaining} ${project.currency} remaining`) : (ar ? "لم تبدأ" : "Not started");
  const customerStateNode: ReactNode = project.customerInvoice && !receivable.complete
    ? <><bdi dir="ltr">{receivable.remaining} {project.currency}</bdi>{ar ? " متبقية" : " remaining"}</>
    : customerState;
  const expenseState = expenses.count ? expenseCount(expenses.count, expenses.total, project.currency, locale) : (ar ? "لا توجد مصروفات مسجلة" : "No expenses recorded");
  const expenseStateNode: ReactNode = expenses.count
    ? <>{expenseLabel(expenses.count, locale)} · <bdi dir="ltr">{expenses.total} {project.currency}</bdi></>
    : expenseState;
  const overview = `/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`;
  const prerequisiteHref = nextAction ? localizeActionHref(nextAction.href, locale) : overview;
  const prerequisite = nextAction ? (ar ? `أولاً: ${nextAction.label}` : `First: ${nextAction.label}`) : (ar ? "المشروع مغلق — راجع السجلات المحفوظة" : "Project closed — review saved records");

  return <article className={styles.projectCard} aria-label={ar ? `العمل المالي لمشروع ${isolate(project.customer)}` : `${isolate(project.customer)} finance work`}>
    <header className={styles.cardHeader}>
      <div><p className={styles.code}><bdi>{project.code}</bdi></p><h3><bdi>{project.customer}</bdi></h3><p><bdi>{project.reference}</bdi> · <bdi>{project.currency}</bdi></p></div>
      <span className={styles.status} data-tone={closed ? "neutral" : "active"}>{projectStatusLabel(project.status, locale)}</span>
    </header>
    <dl className={styles.taskStates}>
      <div><dt>{ar ? "المورد" : "Supplier"}</dt><dd>{supplierState}</dd></div>
      <div><dt>{ar ? "العميل" : "Customer"}</dt><dd>{customerStateNode}</dd></div>
      <div><dt>{ar ? "المصروفات" : "Expenses"}</dt><dd>{expenseStateNode}</dd></div>
    </dl>
    <nav className={styles.taskLinks} aria-label={ar ? `مهام ${isolate(project.customer)}` : `${isolate(project.customer)} tasks`}>
      <TaskAction label={ar ? "فاتورة المورد والدفعة" : "Supplier invoice & payment"} state={supplierState} href={supplierReady ? `${overview}#supplier-finance` : prerequisiteHref} available={!closed} prerequisite={supplierReady ? undefined : prerequisite} />
      <TaskAction label={ar ? "فاتورة العميل والتحصيلات" : "Customer invoice & collections"} state={customerStateNode} href={customerReady ? `${overview}#customer-finance` : prerequisiteHref} available={!closed} prerequisite={customerReady ? undefined : prerequisite} />
      <TaskAction label={ar ? "مصروفات المشروع" : "Project expenses"} state={expenseStateNode} href={expensesReady ? `/projects/${encodeURIComponent(project.id)}/expenses?locale=${locale}` : prerequisiteHref} available={!closed} prerequisite={expensesReady ? undefined : prerequisite} />
      {closed ? <a className={styles.reviewAction} href={overview}><span>{ar ? "مراجعة المشروع المغلق" : "Review closed project"}</span><small>{ar ? "عرض البيانات المسجلة" : "View saved project data"}</small></a> : null}
    </nav>
  </article>;
}

function TaskAction({ label, state, href, available, prerequisite }: { readonly label: string; readonly state: ReactNode; readonly href: string; readonly available: boolean; readonly prerequisite?: string }) {
  const detail: ReactNode = <small>{prerequisite ?? state}</small>;
  return available ? <a href={href}><span>{label}</span>{detail}</a> : <div className={styles.taskUnavailable} aria-disabled="true"><span>{label}</span>{detail}</div>;
}

function localizeActionHref(href: string, locale: Locale): string {
  const [path, fragment] = href.split("#", 2);
  return `${path}?locale=${locale}${fragment ? `#${fragment}` : ""}`;
}

function projectCount(count: number, locale: Locale): string {
  if (locale === "en") return `${count} project${count === 1 ? "" : "s"}`;
  const category = new Intl.PluralRules("ar").select(count);
  return ({ zero: "لا مشاريع", one: "مشروع واحد", two: "مشروعان", few: `${count} مشاريع`, many: `${count} مشروعاً`, other: `${count} مشروع` })[category];
}

function expenseLabel(count: number, locale: Locale): string {
  if (locale === "en") return `${count} recorded`;
  const category = new Intl.PluralRules("ar").select(count);
  return ({ zero: "لا مصروفات", one: "مصروف واحد", two: "مصروفان", few: `${count} مصروفات`, many: `${count} مصروفاً`, other: `${count} مصروف` })[category];
}

function expenseCount(count: number, total: string, currency: string, locale: Locale): string {
  return `${expenseLabel(count, locale)} · ${total} ${currency}`;
}

function isolate(value: string): string {
  return `\u2068${value}\u2069`;
}
