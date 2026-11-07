export function SendAttempts({ locale, sent }: Readonly<{ locale: "ar" | "en"; sent: boolean }>) {
  const ar = locale === "ar";
  const attempts = sent ? [["1", "2026-11-07T09:01:00Z", "FAILED", "SAFE_PROVIDER_UNAVAILABLE"], ["2", "2026-11-07T09:04:00Z", "DELIVERED", "provider-0007"]] : [];
  return <section role="region" aria-labelledby="send-attempts-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, overflowX: "auto" }}>
    <h2 id="send-attempts-title">{ar ? "محاولات الإرسال" : "Send attempts"}</h2>
    <table><thead><tr><th>#</th><th>{ar ? "الوقت" : "Time"}</th><th>{ar ? "النتيجة" : "Result"}</th><th>{ar ? "مرجع آمن" : "Safe reference"}</th></tr></thead><tbody>{attempts.map(([number, at, result, reference]) => <tr key={number}><td>{number}</td><td><bdi>{at}</bdi></td><td>{result}</td><td><bdi>{reference}</bdi></td></tr>)}</tbody></table>
    {sent && <button type="button">{ar ? "إعادة محاولة الإرسال" : "Retry send"}</button>}
  </section>;
}
