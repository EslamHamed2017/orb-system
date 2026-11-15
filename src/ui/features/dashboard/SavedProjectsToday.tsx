"use client";
import { useEffect, useState } from "react";
import { customerReceivableSummary, parseProjectRecords, PROJECT_STORAGE_KEY, projectNextAction, type ProjectAction, type ProjectRecord } from "../../../modules/projects/daily-projects";
import styles from "./Dashboard.module.css";

type ActionableProject = Readonly<{ project: ProjectRecord; action: ProjectAction }>;

function stageLabel(project: ProjectRecord, locale: "ar" | "en"): string {
  const ar = locale === "ar";
  if (project.status === "SETUP") return ar ? "الإعداد" : "Setup";
  if (project.closure?.reopenedAt && !project.closure.reopenReviewedAt) return ar ? "الإغلاق وإعادة الفتح" : "Closure and reopen";
  if (!project.customerShipmentReviewedAt) return ar ? "الشحن" : "Shipments";
  if (!project.supplierPayment) return ar ? "حسابات المورد" : "Supplier finance";
  if (!project.customerInvoice || !customerReceivableSummary(project).complete) return ar ? "حسابات العميل" : "Customer finance";
  if (!project.expenses?.length || project.claims?.some((claim) => claim.status === "OPEN")) return ar ? "المصروفات والمطالبات" : "Expenses and claims";
  return ar ? "الإغلاق" : "Closure";
}

function actionLabel(project: ProjectRecord, action: ProjectAction, locale: "ar" | "en"): string {
  if (project.status === "SETUP") return locale === "ar" ? "إكمال الإعداد" : "Complete setup";
  return action.label;
}

function withLocale(href: string, locale: "ar" | "en"): string {
  const [path, hash] = href.split("#");
  return `${path}?locale=${locale}${hash ? `#${hash}` : ""}`;
}

export function SavedProjectsToday({ locale }: { readonly locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  useEffect(() => { try { setProjects(parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY))); setState("ready"); } catch { setState("error"); } }, []);
  const now = new Date();
  const date = now.toLocaleDateString(ar ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" });
  const actionable = projects.flatMap<ActionableProject>((project) => {
    const action = projectNextAction(project, locale);
    return action ? [{ project, action }] : [];
  });
  const actionSummary = ar
    ? (actionable.length === 1 ? "مشروع واحد يحتاج إلى إجراء" : `${actionable.length} مشروعات تحتاج إلى إجراء`)
    : `${actionable.length} project${actionable.length === 1 ? "" : "s"} need${actionable.length === 1 ? "s" : ""} action`;

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="today-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "مساحة العمل اليومية" : "Daily workspace"}</p><h1 id="today-title">{ar ? "اليوم" : "Today"}</h1><p className={styles.subtitle}>{ar ? "ابدأ بالخطوة المطلوبة التالية لكل مشروع يحتاج إلى عمل." : "Start with the next required step for every project that needs work."}</p></div><time className={styles.date} dateTime={now.toISOString().slice(0, 10)}>{date}</time></header>
    {state === "loading" && <section className={styles.panel}><p className={styles.empty} role="status">{ar ? "جارٍ تحميل عمل اليوم…" : "Loading today’s work…"}</p></section>}
    {state === "error" && <section className={styles.panel}><div className={styles.empty} role="alert"><h2>{ar ? "تعذر تحميل عمل اليوم" : "Today’s work could not be loaded"}</h2><p>{ar ? "تحقق من سماح المتصفح بالتخزين المحلي ثم أعد تحميل الصفحة." : "Allow browser storage, then reload this page."}</p></div></section>}
    {state === "ready" && projects.length === 0 && <section className={styles.panel}><div className={styles.empty}><h2>{ar ? "ابدأ بمشروعك الأول" : "Start with your first project"}</h2><p>{ar ? "أنشئ مشروعاً من بياناتك ليظهر هنا العمل المطلوب. لن يضيف ORB أي بيانات نموذجية." : "Create a project from your own data and its required work will appear here. ORB will not add sample data."}</p><a className={styles.primaryAction} href={`/projects/new?locale=${locale}`}>{ar ? "إنشاء مشروع" : "Create project"}</a></div></section>}
    {state === "ready" && projects.length > 0 && actionable.length === 0 && <section className={styles.panel}><div className={styles.empty}><h2>{ar ? "لا يوجد عمل مطلوب الآن" : "No work needs attention now"}</h2><p>{ar ? "كل المشروعات المحفوظة مغلقة. يمكنك مراجعتها من سجل المشروعات." : "All saved projects are closed. You can review them in the project register."}</p><a className={styles.primaryAction} href={`/projects?locale=${locale}`}>{ar ? "عرض المشاريع" : "View projects"}</a></div></section>}
    {state === "ready" && actionable.length > 0 && <section className={styles.panel} aria-labelledby="actions-heading"><header className={styles.panelHeader}><div><h2 id="actions-heading">{ar ? "العمل المطلوب" : "Work requiring attention"}</h2><p className={styles.queueSummary}>{actionSummary}</p></div><a className={styles.linkAction} href={`/projects?locale=${locale}`}>{ar ? "كل المشاريع" : "All projects"}</a></header><ol className={styles.actionList}>{actionable.map(({ project, action }, index) => <li className={styles.actionCard} data-testid="today-action" key={project.id}>
      <div className={styles.actionNumber} aria-hidden="true">{index + 1}</div>
      <div className={styles.actionCopy}><div className={styles.actionContext}><span className={styles.stageChip}>{stageLabel(project, locale)}</span><span className={styles.projectIdentity}><bdi>{project.code}</bdi> · {project.customer}</span></div><h3>{action.label}</h3><p>{action.detail}</p></div>
      <div className={styles.actionButtons}><a className={styles.primaryAction} href={withLocale(action.href, locale)}>{actionLabel(project, action, locale)}</a><a className={styles.secondaryAction} href={`/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`}>{ar ? "عرض المشروع" : "View project"}</a></div>
    </li>)}</ol><footer className={styles.localNotice}>{ar ? "هذه القائمة من بيانات المشروعات المحفوظة في هذا المتصفح فقط." : "This list uses project data saved in this browser only."}</footer></section>}
  </section>;
}
