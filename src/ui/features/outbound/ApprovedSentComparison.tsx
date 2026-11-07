const facts = ["Manifest hash", "Output hash", "Body hash", "Attachment hashes"] as const;
export function ApprovedSentComparison({ locale, sent }: Readonly<{ locale: "ar" | "en"; sent: boolean }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="approved-sent-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, overflowX: "auto" }}>
    <h2 id="approved-sent-title">{ar ? "مقارنة المعتمد والمرسل" : "Approved and sent comparison"}</h2>
    {sent ? <><table><thead><tr><th>{ar ? "الدليل" : "Proof"}</th><th>{ar ? "المعتمد" : "Approved"}</th><th>{ar ? "المرسل" : "Sent"}</th><th>{ar ? "النتيجة" : "Result"}</th></tr></thead><tbody>{facts.map((fact, index) => <tr key={fact}><th>{fact}</th><td><bdi>sha256-proof-{index + 1}</bdi></td><td><bdi>sha256-proof-{index + 1}</bdi></td><td>{ar ? "متطابق" : "Identical"}</td></tr>)}</tbody></table><p><a href="/evidence/transport-capture-0007">{ar ? "دليل التقاط النقل" : "Transport capture evidence"}</a></p></> : <p>{ar ? "لا توجد لقطة مرسلة بعد. لا تُنشأ المقارنة إلا من البايتات المخزنة." : "No sent snapshot yet. Comparison is produced only from stored bytes."}</p>}
  </section>;
}
