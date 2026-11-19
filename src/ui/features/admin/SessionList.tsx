export interface SessionListItem {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly active: boolean;
}

const format = (value: string, ar: boolean) => new Date(value).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

/** One user's real sessions (from /api/users/{userId}/sessions), with an "end session" action for active ones. */
export function SessionList({ locale, sessions, busy = false, onRevoke }: Readonly<{
  locale: "ar" | "en";
  sessions: readonly SessionListItem[];
  busy?: boolean;
  onRevoke?: (sessionId: string) => void;
}>) {
  const ar = locale === "ar";
  const active = sessions.filter((session) => session.active);
  const ended = sessions.filter((session) => !session.active).slice(0, 5);
  return <section role="region" aria-label={ar ? "جلسات المستخدم المحددة" : "Exact user sessions"} style={{ minWidth: 0 }}>
    <strong>{ar ? "جلسات المستخدم المحددة" : "Exact user sessions"}</strong>
    {active.length === 0 && <p className="orb-muted">{ar ? "لا توجد جلسات نشطة." : "No active sessions."}</p>}
    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
      {active.map((session) => <li key={session.sessionId} data-testid="session-active" style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", fontSize: ".85rem" }}>
        <span>{ar ? "دخول" : "Signed in"} <time dateTime={session.createdAt}>{format(session.createdAt, ar)}</time> · {ar ? "تنتهي" : "expires"} <time dateTime={session.expiresAt}>{format(session.expiresAt, ar)}</time></span>
        {onRevoke && <button type="button" disabled={busy} onClick={() => onRevoke(session.sessionId)} data-operation-id="revokePilotUserSession">{ar ? "إلغاء الجلسة المحددة" : "Revoke exact session"}</button>}
      </li>)}
      {ended.map((session) => <li key={session.sessionId} data-testid="session-revoked" className="orb-muted" style={{ fontSize: ".8rem" }}>
        {ar ? "منتهية" : "Ended"} · <time dateTime={session.revokedAt ?? session.expiresAt}>{format(session.revokedAt ?? session.expiresAt, ar)}</time>
      </li>)}
    </ul>
  </section>;
}
