import styles from "./Dashboard.module.css";

type Item = Readonly<{ id: string; family: string; label: string; severity?: string; source: Readonly<{ href: string }> }>;
const groups = [
  ["approvals", ["approvals"]], ["route/evidence", ["routes", "evidence"]], ["document/outbound", ["documents", "outbound"]],
  ["invoice/settlement", ["invoices", "settlements"]], ["expense", ["expenses"]], ["claim", ["claims"]],
  ["closure", ["closure"]], ["audit", ["audit"]], ["recovery", ["recovery"]],
] as const;

export function TodayBlockers({ locale, items }: Readonly<{ locale: "ar" | "en"; items: readonly Item[] }>) {
  const ar = locale === "ar";
  const title = ar ? "العوائق التشغيلية" : "Operational blockers";
  return <section className={styles.panel} role="region" aria-label={title}>
    <header className={styles.panelHeader}><div><h2>{ar ? "الأولوية التالية" : "Next priorities"}</h2><p className={styles.kpiMeta}>{ar ? "عناصر تتطلب اتخاذ إجراء" : "Items requiring action"}</p></div><a className={styles.linkAction} href={"/approvals?locale=" + locale}>{ar ? "عرض الكل" : "View all"}</a></header>
    <ul className={styles.blockerList}>{groups.map(([group, families]) => { const matches = items.filter((item) => (families as readonly string[]).includes(item.family)); return <li key={group} data-testid={"today-" + group}>{matches.map((item) => <div className={styles.blockerRow} key={item.id}>
      <span className={styles.severity} data-tone={item.severity === "CRITICAL" ? "critical" : "warning"} aria-hidden="true">{item.severity === "CRITICAL" ? "!" : "•"}</span>
      <div className={styles.blockerCopy}><a href={item.source.href}>{item.label}</a><p>{ar ? "راجع المصدر لحل هذا العائق" : "Review source and resolve this blocker"}</p></div>
      <span className={styles.familyChip}>{item.family}</span>
    </div>)}{matches.length === 0 ? <p className={styles.empty}>{ar ? "لا توجد عناصر نشطة" : "No active items"}</p> : null}</li>; })}</ul>
  </section>;
}
