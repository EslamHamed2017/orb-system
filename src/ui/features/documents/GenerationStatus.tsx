export type GenerationState = "QUEUED" | "RENDERING" | "READY" | "FAILED";

export function GenerationStatus({ locale, state = "READY" }: Readonly<{ locale: "ar" | "en"; state?: GenerationState }>) {
  const ar = locale === "ar";
  const stateLabel = { QUEUED: ar ? "في قائمة الانتظار" : "Queued", RENDERING: ar ? "قيد الإنشاء" : "Rendering", READY: ar ? "جاهز" : "Ready", FAILED: ar ? "فشل" : "Failed" }[state];
  return <section role="region" aria-labelledby="generation-status-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="generation-status-title">{ar ? "حالة الإنشاء" : "Generation status"}</h2>
    <p><bdi>ORB-SAL-0007</bdi> · {ar ? "مجموعة البيانات المعتمدة، المراجعة 2" : "Approved dataset revision 2"}</p>
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      <label>{ar ? "نوع المستند" : "Document kind"}<select aria-label={ar ? "نوع المستند" : "Document kind"} defaultValue="CINV"><option value="CINV">CINV</option><option value="PACKING_LIST">Packing List</option></select></label>
      <label>{ar ? "لغة المستند" : "Document language"}<select aria-label={ar ? "لغة المستند" : "Document language"} defaultValue="BILINGUAL"><option value="AR">AR</option><option value="EN">EN</option><option value="BILINGUAL">BILINGUAL</option></select></label>
    </div>
    <p role="status"><strong>{stateLabel}</strong> · <bdi>DOC-0007-R2</bdi></p>
    {state === "READY" ? <><a href="/api/evidence/demo/content?disposition=inline">{ar ? "معاينة المخرجات" : "Preview output"}</a><button type="button" data-operation-id="generateShipmentDocument">{ar ? "إنشاء إصدار جديد" : "Generate new version"}</button></> : <button type="button" data-operation-id="generateShipmentDocument">{ar ? "تحديث الحالة" : "Refresh status"}</button>}
  </section>;
}
