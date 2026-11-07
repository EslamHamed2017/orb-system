export function SalesShipmentDocumentsPanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="shipment-documents-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="shipment-documents-title">{ar ? "مستندات شحنة البيع" : "Sales shipment documents"}</h2>
    <p><bdi>ORB-SAL-0007</bdi> · <bdi>DOC-0007-R2</bdi> · {ar ? "المراجعة 2 محفوظة؛ بايتات المراجعة 1 لم تتغير" : "Revision 2 retained; revision 1 bytes remain immutable"}</p>
    <label>{ar ? "سبب المراجعة أو الإلغاء" : "Revision or cancellation reason"}<textarea aria-label={ar ? "سبب المراجعة أو الإلغاء" : "Revision or cancellation reason"} minLength={3} /></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}><button type="button">{ar ? "إرسال المستند للموافقة" : "Submit document for approval"}</button><button type="button">{ar ? "مراجعة المستند" : "Revise document"}</button><button type="button">{ar ? "إلغاء المراجعة" : "Cancel revision"}</button></div>
  </section>;
}
