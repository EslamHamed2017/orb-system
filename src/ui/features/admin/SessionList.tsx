export function SessionList({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="sessions-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, minWidth: 0, padding: 16 }}>
    <h2 id="sessions-title">{ar ? "جلسات المستخدم المحددة" : "Exact user sessions"}</h2>
    <div style={{ display: "grid", gap: 12 }}>
      <article data-testid="session-active" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 12, overflowWrap: "anywhere", padding: 12 }}>
        <h3><bdi>SESSION-ACTIVE-0007</bdi></h3><p>Version 4 · CURRENT · Last seen 2026-11-07T09:15:00Z · Idle expiry 2026-11-07T09:45:00Z · Absolute expiry 2026-11-07T20:00:00Z</p>
        <p>Revoked at: null · Revoked by: null · Revocation reason: null</p><button type="button">{ar ? "إلغاء الجلسة المحددة" : "Revoke exact session"}</button>
      </article>
      <article data-testid="session-revoked" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 12, overflowWrap: "anywhere", padding: 12 }}>
        <h3><bdi>SESSION-REVOKED-0006</bdi></h3><p>Version 3 · Revoked at 2026-11-07T08:00:00Z · Revoked by Owner user · Security review</p>
      </article>
    </div>
  </section>;
}
