import styles from "./Dashboard.module.css";
import { TodayBlockers } from "./TodayBlockers";

type Item = Readonly<{ id: string; family: string; label: string; severity?: string; source: Readonly<{ href: string }> }>;
type Recent = Readonly<{ id: string; label: string; source: Readonly<{ href: string }> }>;

export function TodayDashboard({ locale, blockers, recentProjects }: Readonly<{ locale: "ar" | "en"; blockers: readonly Item[]; recentProjects: readonly Recent[] }>) {
  const ar = locale === "ar";
  const critical = blockers.filter((item) => item.severity === "CRITICAL").length;
  const kpis = [
    { label: ar ? "إجراءات مطلوبة" : "Actions required", value: blockers.length, meta: ar ? "حسب أولوية المخاطر" : "Prioritized by risk", tone: "warning", icon: "!" },
    { label: ar ? "موافقات معينة" : "Assigned approvals", value: blockers.filter((item) => item.family === "approvals").length, meta: ar ? "في صندوق الوارد" : "In your inbox", tone: "primary", icon: "✓" },
    { label: ar ? "مشاريع نشطة" : "Active projects", value: recentProjects.length, meta: ar ? "نشاط حديث" : "With recent activity", tone: "success", icon: "▣" },
    { label: ar ? "مخاطر حرجة" : "Critical risks", value: critical, meta: ar ? "تحتاج متابعة فورية" : "Need immediate review", tone: critical ? "warning" : "success", icon: "▲" },
  ];
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "مساحة العمل التشغيلية" : "Operational workspace"}</p><h1>{ar ? "اليوم" : "Today"}</h1><p className={styles.subtitle}>{ar ? "نظرة مركزة على ما يحتاج إلى اهتمامك الآن." : "A focused view of what needs your attention now."}</p></div><time className={styles.date} dateTime="2026-11-07">{ar ? "٧ نوفمبر ٢٠٢٦" : "7 Nov 2026"}</time></header>
    <div className={styles.kpiGrid}>{kpis.map((kpi) => <article className={styles.kpiCard} key={kpi.label}><div className={styles.kpiTop}><p className={styles.kpiLabel}>{kpi.label}</p><span className={styles.iconBox} data-tone={kpi.tone}>{kpi.icon}</span></div><p className={styles.kpiValue}>{kpi.value}</p><p className={styles.kpiMeta}>{kpi.meta}</p></article>)}</div>
    <div className={styles.contentGrid}><TodayBlockers locale={locale} items={blockers} /><section className={styles.panel} role="region" aria-label={ar ? "المشروعات الأخيرة" : "Recent projects"}><header className={styles.panelHeader}><h2>{ar ? "المشروعات الأخيرة" : "Recent projects"}</h2><a className={styles.linkAction} href={"/projects?locale=" + locale}>{ar ? "عرض الكل" : "View all"}</a></header><ul className={styles.recentList}>{recentProjects.map((item) => <li className={styles.recentItem} key={item.id}><span className={styles.projectMark} aria-hidden="true">O</span><div className={styles.recentCopy}><a href={item.source.href}>{item.label}</a><p>{ar ? "عميل تجريبي · نشط" : "Pilot Customer · Active"}</p></div><span className={styles.arrow} aria-hidden="true">{ar ? "←" : "→"}</span></li>)}</ul></section></div>
  </section>;
}
