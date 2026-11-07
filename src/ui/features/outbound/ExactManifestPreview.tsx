export function ExactManifestPreview({ locale, drift = false }: Readonly<{ locale: "ar" | "en"; drift?: boolean }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="manifest-preview-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="manifest-preview-title">{ar ? "معاينة بيان الإرسال الدقيقة" : "Exact manifest preview"}</h2>
    <p><strong>{drift ? (ar ? "تتطلب إعادة الاعتماد" : "REAPPROVAL REQUIRED") : "APPROVED"}</strong> · <bdi>MAN-0007-V2</bdi></p>
    <dl style={{ display: "grid", gap: 8 }}><div><dt>{ar ? "القناة" : "Channel"}</dt><dd>EMAIL</dd></div><div><dt>To</dt><dd><bdi>ops@example.test</bdi></dd></div><div><dt>Cc</dt><dd><bdi>finance@example.test</bdi></dd></div><div><dt>{ar ? "الموضوع" : "Subject"}</dt><dd><bdi>ORB-SAL-0007 commercial documents</bdi></dd></div><div><dt>{ar ? "نص الرسالة" : "Body"}</dt><dd><bdi>text/plain · 48 bytes · body-sha256-0007</bdi></dd></div></dl>
    <table><caption>{ar ? "المرفقات الدقيقة" : "Exact attachments"}</caption><thead><tr><th>{ar ? "الملف" : "Filename"}</th><th>{ar ? "الإصدار" : "Version"}</th><th>{ar ? "الحجم" : "Size"}</th><th>SHA-256</th></tr></thead><tbody><tr><td><bdi>cinv-ORB-SAL-0007.pdf</bdi></td><td>2</td><td>64 bytes</td><td><bdi>cinv-sha256-0007</bdi></td></tr><tr><td><bdi>packing-list-ORB-SAL-0007.pdf</bdi></td><td>2</td><td>96 bytes</td><td><bdi>packing-sha256-0007</bdi></td></tr></tbody></table>
    {drift && <><p>{ar ? "الموافقة السابقة غير منطبقة؛ أنشئ مراجعة بديلة." : "Prior approval is inapplicable; create a superseding revision."}</p><label>{ar ? "سبب المراجعة أو الإلغاء" : "Revision or cancellation reason"}<textarea aria-label={ar ? "سبب المراجعة أو الإلغاء" : "Revision or cancellation reason"} minLength={3} /></label></>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}><button type="button" disabled={drift}>{ar ? "إرسال الآن" : "Send now"}</button><button type="button">{ar ? "مراجعة بيان الإرسال" : "Revise manifest"}</button><button type="button">{ar ? "إلغاء بيان الإرسال" : "Cancel manifest"}</button></div>
  </section>;
}
