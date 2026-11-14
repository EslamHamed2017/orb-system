"use client";
import { useEffect, useState } from "react";
import { parseProjectRecords, PROJECT_STORAGE_KEY, projectNextAction, projectStatusLabel, type ProjectRecord } from "../../../modules/projects/daily-projects";
import styles from "./Projects.module.css";

type LoadState = "loading" | "ready" | "missing" | "error";
type LifecycleItem = Readonly<{ label: string; status: string }>;

export function SavedProjectDetail({ id, locale }: { readonly id: string; readonly locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  useEffect(() => {
    try {
      const found = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).find((item) => item.id === id);
      if (found) { setProject(found); setState("ready"); } else setState("missing");
    } catch { setState("error"); }
  }, [id]);

  if (state === "loading") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="status">{ar ? "جارٍ تحميل المشروع…" : "Loading project…"}</div></section>;
  if (state === "error") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="alert"><h1>{ar ? "تعذر فتح المشروع" : "Project could not be opened"}</h1><p>{ar ? "تحقق من التخزين المحلي وأعد تحميل الصفحة." : "Check browser storage and reload the page."}</p></div></section>;
  if (state === "missing" || !project) return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><p>{ar ? "لم يتم العثور على مشروع محفوظ بهذا الرابط في هذا المتصفح." : "No saved project for this link was found in this browser."}</p><a className={styles.outlinedButton} href={`/projects?locale=${locale}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></section>;

  const next = projectNextAction(project.status, locale, project.id);
  const tasks: LifecycleItem[] = (ar ? [
    "العميل والمورد", "عقود البيع والشراء", "شحنات المورد والعميل", "الفواتير والمدفوعات", "المصروفات", "المطالبات", "الإغلاق وإعادة الفتح",
  ] : [
    "Customer and supplier", "Sales and purchase contracts", "Supplier and customer shipments", "Invoices and payments", "Expenses", "Claims", "Closure and reopening",
  ]).map((label) => ({ label, status: ar ? "لم يبدأ" : "Not started" }));
  const [nextPath, nextHash] = next.href.split("#");
  const nextHref = `${nextPath}?locale=${locale}${nextHash ? `#${nextHash}` : ""}`;

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="project-title">
    <header className={styles.overviewHeader}><div className={styles.overviewTop}><div><p className={styles.code}>{project.code}</p><h1 id="project-title">{project.customer}</h1><p className={styles.subtitle}>{project.reference} · <bdi>{project.origin} → {project.destination}</bdi></p><div className={styles.statusRow}><span className={styles.status}>{projectStatusLabel(project.status, locale)}</span><span className={styles.browserBadge}>{ar ? "محفوظ في هذا المتصفح" : "Saved in this browser"}</span></div></div><div className={styles.overviewActions}><a className={styles.filledButton} href={nextHref}>{next.label}</a></div></div></header>
    <section className={styles.nextAction}><p>{ar ? "الإجراء التالي" : "Next action"}</p><h2>{next.label}</h2><span>{next.detail}</span></section>
    <div className={styles.detailGrid}><section className={styles.panel} id="lifecycle"><header className={styles.panelHeader}><div><h2>{ar ? "مسار دورة العمل" : "Lifecycle tasks"}</h2><p className={styles.muted}>{ar ? "لن نفتح سجلات تجريبية. ستصبح كل خطوة متاحة بعد ربطها ببيانات هذا المشروع." : "No demo register is opened. Each step will become available when it is connected to this project’s data."}</p></div></header><ol className={styles.lifecycle}>{tasks.map((task, index) => <li key={`${task.label}-${index}`}><span>{index + 1}</span><div><h3>{task.label}</h3><p>{task.status}</p></div></li>)}</ol></section>
      <aside className={styles.panel} id="project-data"><header className={styles.panelHeader}><h2>{ar ? "بيانات المشروع" : "Project data"}</h2></header><dl className={styles.detailFacts}><div><dt>{ar ? "مرجع العقد" : "Contract reference"}</dt><dd>{project.contractReference}</dd></div><div><dt>{ar ? "السلعة" : "Commodity"}</dt><dd>{project.commodity}</dd></div><div><dt>{ar ? "الكمية" : "Quantity"}</dt><dd><bdi>{project.quantity} {project.unit}</bdi></dd></div><div><dt>{ar ? "السعر لكل وحدة" : "Unit price"}</dt><dd><bdi>{project.unitPrice} {project.currency}</bdi></dd></div><div><dt>{ar ? "تاريخ البدء" : "Start date"}</dt><dd><time dateTime={project.startDate}>{project.startDate}</time></dd></div></dl><p className={styles.truthNote}>{ar ? "لا توجد أرقام تشغيلية أو مالية مسجلة لهذا المشروع حتى الآن." : "No operational or financial figures are recorded for this project yet."}</p></aside></div>
  </section>;
}
