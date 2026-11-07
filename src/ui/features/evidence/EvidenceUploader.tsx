export type EvidenceUploaderLocale = "ar" | "en";

export function EvidenceUploader({ locale, subjectId }: Readonly<{ locale: EvidenceUploaderLocale; subjectId: string }>) {
  const ar = locale === "ar";
  return <form aria-label={ar ? "رفع دليل" : "Upload evidence"} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid var(--orb-color-outline-variant)", borderRadius: 16 }}>
    <input type="hidden" name="subjectId" value={subjectId} />
    <label>{ar ? "ملف الدليل" : "Evidence file"}<input type="file" name="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "block", minHeight: 48 }} /></label>
    <p>{ar ? "يتم التحقق من SHA-256 والنوع والحجم قبل الإرفاق." : "SHA-256 is verified before attachment, together with media type and byte size."}</p>
    <button type="submit">{ar ? "رفع والتحقق" : "Upload and verify"}</button>
  </form>;
}
