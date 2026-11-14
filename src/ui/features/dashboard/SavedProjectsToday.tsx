"use client";
import { useEffect, useState } from "react";
import { parseProjectRecords, PROJECT_STORAGE_KEY, projectNextAction, type ProjectAction, type ProjectRecord } from "../../../modules/projects/daily-projects";
import styles from "./Dashboard.module.css";

type ActionableProject = Readonly<{ project: ProjectRecord; action: ProjectAction }>;

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
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="today-title"><header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "مساحة العمل الشخصية" : "Personal workspace"}</p><h1 id="today-title">{ar ? "اليوم" : "Today"}</h1><p className={styles.subtitle}>{ar ? "إجراء تالٍ واحد لكل مشروع محفوظ يحتاج إلى عمل ضمن هذا المسار المحدود." : "One next action for each saved project that needs work in this bounded flow."}</p></div><time className={styles.date} dateTime={now.toISOString().slice(0, 10)}>{date}</time></header>
    {state === "loading" && <section className={styles.panel}><p className={styles.empty} role="status">{ar ? "جارٍ تحميل إجراءات اليوم…" : "Loading today’s actions…"}</p></section>}
    {state === "error" && <section className={styles.panel}><div className={styles.empty} role="alert"><h2>{ar ? "تعذر تحميل إجراءات اليوم" : "Today’s actions could not be loaded"}</h2><p>{ar ? "تحقق من سماح المتصفح بالتخزين المحلي ثم أعد تحميل الصفحة." : "Allow browser storage, then reload this page."}</p></div></section>}
    {state === "ready" && projects.length === 0 && <section className={styles.panel}><div className={styles.empty}><h2>{ar ? "لا توجد إجراءات بعد" : "No actions yet"}</h2><p>{ar ? "أنشئ مشروعاً من بياناتك لعرض إجراء اليوم التالي. لن تتم إضافة مشروع نموذجي إلى قائمتك الشخصية." : "Create a project from your own data to see its next action. No sample project is inserted into your personal list."}</p><a className={styles.linkAction} href={`/projects/new?locale=${locale}`}>{ar ? "إنشاء مشروع" : "Create project"}</a></div></section>}
    {state === "ready" && projects.length > 0 && actionable.length === 0 && <section className={styles.panel}><div className={styles.empty}><h2>{ar ? "لا توجد إجراءات مستحقة" : "No actions due"}</h2><p>{ar ? "لا يوجد إجراء تالٍ محدد لأي مشروع محفوظ ضمن هذا المسار المحدود." : "No saved project has a next action defined in this bounded flow."}</p><a className={styles.linkAction} href={`/projects?locale=${locale}`}>{ar ? "عرض المشاريع" : "View projects"}</a></div></section>}
    {state === "ready" && actionable.length > 0 && <section className={styles.panel} aria-labelledby="actions-heading"><header className={styles.panelHeader}><div><h2 id="actions-heading">{ar ? "الإجراءات التالية" : "Next actions"}</h2><p className={styles.subtitle}>{ar ? (actionable.length === 1 ? "إجراء واحد مستحق" : `${actionable.length} إجراءات مستحقة`) : `${actionable.length} action${actionable.length === 1 ? "" : "s"} due`}</p></div><a className={styles.linkAction} href={`/projects?locale=${locale}`}>{ar ? "عرض المشاريع" : "View projects"}</a></header><ul className={styles.actionList}>{actionable.map(({ project, action }) => { const [actionPath, actionHash] = action.href.split("#"); return <li className={styles.actionCard} key={project.id}><div className={styles.actionNumber} aria-hidden="true">{ar ? "←" : "→"}</div><div><p className={styles.actionProject}>{project.code} · {project.customer}</p><h3>{action.label}</h3><p>{action.detail}</p></div><a className={styles.openAction} href={`${actionPath}?locale=${locale}${actionHash ? `#${actionHash}` : ""}`}>{ar ? "فتح الإجراء" : "Open action"}</a></li>; })}</ul></section>}
  </section>;
}
