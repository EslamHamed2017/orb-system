export interface EvidenceViewerMetadata {
  readonly id: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly mediaType: string;
  readonly originalFilename: string;
  readonly verificationState: "PENDING" | "VERIFIED" | "REJECTED";
  readonly verifiedAt: string | null;
  readonly verifiedBy: { readonly displayName: string } | null;
  readonly sourceLinks: readonly Readonly<{ reference: string; href: string; purpose: string }>[];
}

export function EvidenceViewer({ locale, metadata }: Readonly<{ locale: "ar" | "en"; metadata: EvidenceViewerMetadata }>) {
  const ar = locale === "ar";
  const absent = ar ? "لم يتم التحقق بعد" : "Not verified yet";
  return <section aria-labelledby="evidence-title" style={{ display: "grid", gap: 16 }}>
    <header><p>{ar ? "دليل غير قابل للتغيير" : "Immutable evidence"}</p><h1 id="evidence-title">{ar ? "الدليل" : "Evidence"} {metadata.originalFilename}</h1></header>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(9rem, auto) 1fr", gap: 8 }}>
      <dt>{ar ? "الحالة" : "Verification state"}</dt><dd><strong>{metadata.verificationState}</strong></dd>
      <dt>SHA-256</dt><dd><code style={{ overflowWrap: "anywhere" }}>{metadata.sha256}</code></dd>
      <dt>{ar ? "نوع الوسائط" : "Media type"}</dt><dd>{metadata.mediaType}</dd>
      <dt>{ar ? "الحجم" : "Byte size"}</dt><dd>{metadata.byteLength.toLocaleString("en-US")} bytes</dd>
      <dt>{ar ? "وقت التحقق" : "Verified at"}</dt><dd>{metadata.verifiedAt ?? absent}</dd>
      <dt>{ar ? "تم التحقق بواسطة" : "Verified by"}</dt><dd>{metadata.verifiedBy?.displayName ?? absent}</dd>
    </dl>
    <nav aria-label={ar ? "إجراءات الدليل المدققة" : "Audited evidence actions"} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href={`/api/evidence/${metadata.id}/content?disposition=inline`}>{ar ? "عرض الملف" : "View file"}</a>
      <a href={`/api/evidence/${metadata.id}/content?disposition=attachment`}>{ar ? "تنزيل" : "Download"}</a>
    </nav>
    <section aria-labelledby="evidence-sources"><h2 id="evidence-sources">{ar ? "روابط المصدر" : "Source links"}</h2><ul>{metadata.sourceLinks.map((link) => <li key={`${link.href}:${link.purpose}`}><a href={link.href}>{link.reference}</a> — {link.purpose}</li>)}</ul></section>
  </section>;
}
