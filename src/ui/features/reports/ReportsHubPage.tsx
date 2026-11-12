import styles from "./ReportsHubPage.module.css";
import { buildReportDestinations, buildReportFilterAction, type ReportFilter } from "./reports-hub";

export function ReportsHubPage({ filter }: { readonly filter: ReportFilter }) {
  const ar = filter.locale === "ar", reports = buildReportDestinations(filter);
  const label = (en: string, arText: string) => ar ? arText : en;
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="reports-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{label("Operational reports", "تقارير تشغيلية")}</p><h1 id="reports-title">{label("Reports hub", "مركز التقارير")}</h1><p className={styles.subtitle}>{label("Filter approved operational data across projects, then open a focused report with the same context.", "صفّ بيانات العمليات المعتمدة عبر المشاريع، ثم افتح تقريراً متخصصاً مع الاحتفاظ بالسياق نفسه.")}</p></div>
      <p className={styles.notice}>{label("No general ledger, stock balance or inventory valuation", "لا دفتر أستاذ عام ولا رصيد مخزون ولا تقييم مخزون")}</p>
    </header>
    <form className={styles.filters} action={buildReportFilterAction(filter)} method="get" aria-label={label("Report filters", "مرشحات التقارير")}>
      <input type="hidden" name="locale" value={filter.locale}/>{filter.role && <input type="hidden" name="role" value={filter.role}/>}
      <label><span>{label("Project", "المشروع")}</span><input name="projectId" defaultValue={filter.projectId} placeholder={label("All projects", "كل المشاريع")}/></label>
      <label><span>{label("From", "من")}</span><input name="from" type="date" defaultValue={filter.from}/></label>
      <label><span>{label("To", "إلى")}</span><input name="to" type="date" defaultValue={filter.to}/></label>
      <button type="submit">{label("Apply filters", "تطبيق المرشحات")}</button>
      <a href={buildReportFilterAction({ locale: filter.locale, role: filter.role })}>{label("Clear", "مسح")}</a>
    </form>
    <p className={styles.context} aria-live="polite">{filter.projectId ? label("Filtered project", "المشروع المحدد") : label("All projects", "كل المشاريع")}: <bdi>{filter.projectId || label("All", "الكل")}</bdi>{filter.from || filter.to ? <> · <bdi>{filter.from || "…"}</bdi> — <bdi>{filter.to || "…"}</bdi></> : null}</p>
    <nav className={styles.grid} aria-label={label("Available reports", "التقارير المتاحة")}>
      {reports.map((report) => <a className={styles.card} href={report.apiHref} key={report.key}><span className={styles.cardIcon} aria-hidden="true">↗</span><h2>{report.label}</h2><p>{report.description}</p><span className={styles.open}>{label("Open report", "فتح التقرير")} {ar ? "←" : "→"}</span></a>)}
    </nav>
  </section>;
}
