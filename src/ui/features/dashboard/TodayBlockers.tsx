type Item = Readonly<{ id: string; family: string; label: string; source: Readonly<{ href: string }> }>;
const groups = [
  ["approvals", ["approvals"]], ["route/evidence", ["routes", "evidence"]], ["document/outbound", ["documents", "outbound"]],
  ["invoice/settlement", ["invoices", "settlements"]], ["expense", ["expenses"]], ["claim", ["claims"]],
  ["closure", ["closure"]], ["audit", ["audit"]], ["recovery", ["recovery"]],
] as const;
export function TodayBlockers({ locale, items }: Readonly<{ locale: "ar" | "en"; items: readonly Item[] }>) {
  const ar = locale === "ar", title = ar ? "العوائق التشغيلية" : "Operational blockers";
  return <section role="region" aria-label={title} style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, display: "grid", gap: 12, minWidth: 0, padding: 16 }}>
    <h2>{title}</h2>{groups.map(([group, families]) => { const matches = items.filter((item) => (families as readonly string[]).includes(item.family)); return <article key={group} data-testid={`today-${group}`} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 12, padding: 12 }}>
      <h3>{group}</h3>{matches.length ? <ul>{matches.map((item) => <li key={item.id}><a href={item.source.href}>{item.label}</a></li>)}</ul> : <p>{ar ? "لا توجد عناصر نشطة" : "No active items"}</p>}
    </article>; })}
  </section>;
}
