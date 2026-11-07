export interface ClosureBlockerView {
  readonly code: string;
  readonly subject: string;
  readonly eligible: boolean;
}

export function BlockerGroup({ locale, blockers }: Readonly<{ locale: "ar" | "en"; blockers: readonly ClosureBlockerView[] }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="closure-blockers-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, minWidth: 0 }}>
    <h2 id="closure-blockers-title">{ar ? "موانع الإغلاق" : "Closure blockers"}</h2>
    <p>{ar ? "تُعرض جميع الموانع من السجلات النشطة التي يمكن الوصول إليها." : "Every blocker from reachable active records is shown."}</p>
    <div style={{ display: "grid", gap: 12 }}>
      {blockers.map((blocker) => <article key={blocker.code} data-testid={`blocker-${blocker.code}`} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 12, padding: 12, overflowWrap: "anywhere" }}>
        <h3><bdi>{blocker.code}</bdi></h3><p><bdi>{blocker.subject}</bdi></p>
        {blocker.eligible
          ? <label><input type="checkbox" name="blocker" value={blocker.code} /> {ar ? "مؤهل للاستثناء" : "Exception eligible"}</label>
          : <p><strong>{ar ? "غير مؤهل للاستثناء" : "Exception prohibited"}</strong></p>}
      </article>)}
    </div>
    <button type="button" style={{ marginBlockStart: 16 }}>{ar ? "طلب استثناء" : "Request exception"}</button>
  </section>;
}
