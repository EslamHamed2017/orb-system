export function ApprovalDialog({ locale, canDecide = true }: Readonly<{ locale: "ar" | "en"; canDecide?: boolean }>) {
  const ar = locale === "ar";
  const hash = "7069e1419e028a9d1eb82af5753b67e69982964da7619e3683067a7a68c5b468";
  return <section role="region" aria-labelledby="approval-decision-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, display: "grid", gap: 12, minWidth: 0, padding: 16 }}>
    <h2 id="approval-decision-title">{ar ? "قرار الموافقة" : "Approval decision"}</h2>
    <dl style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" }}>
      <div><dt>{ar ? "الإجراء" : "Action"}</dt><dd>EXTERNAL_SEND</dd></div><div><dt>{ar ? "نوع الموضوع" : "Subject type"}</dt><dd>OUTBOUND_MANIFEST</dd></div>
      <div><dt>{ar ? "مرجع الموضوع" : "Subject reference"}</dt><dd><bdi>ORB-MAN-0007</bdi></dd></div><div><dt>{ar ? "الربط" : "Binding"}</dt><dd>{ar ? "الإصدار 3" : "Version 3"}</dd></div>
    </dl>
    <p>{ar ? "تجزئة الموضوع الدقيقة" : "Exact subject hash"}: <bdi style={{ overflowWrap: "anywhere" }}>{hash}</bdi></p>
    <div style={{ overflowX: "auto" }}><table aria-label={ar ? "الحقول المتغيرة" : "Changed fields"} style={{ minWidth: 540, width: "100%" }}><thead><tr><th>{ar ? "الحقل" : "Field"}</th><th>{ar ? "قبل" : "Before"}</th><th>{ar ? "بعد" : "After"}</th></tr></thead><tbody><tr><th scope="row">orderedToRecipients</th><td><bdi>ops@example.test</bdi></td><td><bdi>customer@example.test</bdi></td></tr></tbody></table></div>
    <p><a href="/evidence/EVIDENCE-0007">EVIDENCE-0007 · SHA-256 · 128 bytes</a></p>
    <p>{ar ? "حظر: تغير المستلم بعد المراجعة السابقة" : "BLOCKING: recipient changed after prior review"}</p>
    <p>{ar ? "مقدم الطلب: مستخدم العمليات · 2026-11-07T08:30:00Z" : "Requested by: Operations user · 2026-11-07T08:30:00Z"}</p>
    <p>{ar ? "الدور المطلوب: المالك/المسؤول" : "Required role: OWNER_ADMIN"}</p>
    <p>{ar ? "الموافقة: قيد الانتظار · الإصدار 2" : "Approval: PENDING · version 2"}</p>
    <p><strong>{ar ? "الموافقة الذاتية محظورة" : "Self-approval is forbidden"}</strong> · {ar ? "يجب أن يقرر مالك/مسؤول مختلف." : "A different Owner/Admin must decide."}</p>
    {canDecide && <div data-required-role="OWNER_ADMIN" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" data-operation-id="decideFixedApproval" disabled>{ar ? "موافقة" : "Approve"}</button><button type="button" data-operation-id="decideFixedApproval">{ar ? "رفض" : "Reject"}</button></div>}
  </section>;
}
