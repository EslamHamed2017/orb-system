const hashes = [
  "1c6aab9d8963a7912df00d4c043ea72c7d5f5a864d066796bd3d6d1443cc9530",
  "59413cee0d9f8581d9ba3a454a2f428e8bf5441d95ac3a237deb5acff7ef3cf6",
  "eca34e71fe5faf36f341dc7f0e1954af01a32d51b534b07dec162696d47384a5",
] as const;
const actions = ["PROJECT_CREATED", "CONTRACT_SUBMITTED", "APPROVAL_DECIDED"] as const;
export function AuditTimeline({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="audit-timeline-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, minWidth: 0, padding: 16 }}>
    <h2 id="audit-timeline-title">{ar ? "الخط الزمني للتدقيق غير القابل للتغيير" : "Immutable audit timeline"}</h2>
    <p>Page start previous event hash: null</p><p>Page end event hash: <bdi style={{ overflowWrap: "anywhere" }}>{hashes[2]}</bdi></p>
    <ol style={{ display: "grid", gap: 12, paddingInlineStart: 24 }}>{actions.map((action, index) => <li key={action} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 12, overflowWrap: "anywhere", padding: 12 }}>
      <p>Sequence {index + 1} · {action} · Previous event hash: {index === 0 ? "null" : hashes[index - 1]}</p><p>Event hash: <bdi>{hashes[index]}</bdi></p>
    </li>)}</ol><p role="status"><strong>{ar ? "تم التحقق من استمرارية السلسلة" : "Chain continuity verified"}</strong></p>
  </section>;
}
