const rows = [
  ["Shipment", "ORB-SAL-0007", "ORB-SAL-0007"],
  ["Customer", "Northstar Roasters", "Northstar Roasters"],
  ["Coffee", "Ethiopia Guji G1", "Ethiopia Guji G1"],
  ["Quantity", "10,000 kg", "10,000 kg"],
] as const;

export function SharedFieldComparison({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="shared-fields-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, overflowX: "auto" }}>
    <h2 id="shared-fields-title">{ar ? "مقارنة الحقول المشتركة" : "Shared field comparison"}</h2>
    <p role="status" style={{ color: "var(--orb-color-primary)" }}><strong>{ar ? "صفر اختلاف" : "Zero mismatch"}</strong> · {ar ? "كلا المخرجين من مجموعة البيانات المعتمدة نفسها" : "Both outputs use the same approved dataset"}</p>
    <table><caption>{ar ? "تكافؤ CINV وقائمة التعبئة" : "CINV and Packing List parity"}</caption><thead><tr><th>{ar ? "الحقل" : "Field"}</th><th>CINV</th><th>Packing List</th></tr></thead><tbody>{rows.map(([field, cinv, packing]) => <tr key={field}><th>{field}</th><td><bdi>{cinv}</bdi></td><td><bdi>{packing}</bdi></td></tr>)}</tbody></table>
  </section>;
}
