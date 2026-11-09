const changes = [
  ["Amount", "المبلغ", "USD 1,250.00", "USD 1,100.00"],
  ["Category", "الفئة", "Freight", "Freight"],
  ["Occurred on", "تاريخ المصروف", "2026-11-06", "2026-11-07"],
  ["Proof evidence", "دليل المصروف", "EVIDENCE-ORIGINAL-0007", "EVIDENCE-REPLACEMENT-0008"],
] as const;
export function ExpenseCorrectionDialog({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="expense-correction-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
    <h2 id="expense-correction-title">{ar ? "تصحيح المصروف المعتمد" : "Correct approved expense"}</h2>
    <p>{ar ? "الموافقة: معتمد • الإصدار والزوج القديم/الجديد مرتبطان بدقة." : "Approval: APPROVED · exact version and old/new pair are bound."}</p>
    <div style={{ overflowX: "auto" }}><table aria-label={ar ? "مقارنة تصحيح المصروف" : "Expense correction comparison"} style={{ minWidth: 620, width: "100%" }}><thead><tr><th>{ar ? "الحقل" : "Field"}</th><th>{ar ? "قبل" : "Before"}</th><th>{ar ? "بعد" : "After"}</th></tr></thead><tbody>{changes.map(([en, arabic, before, after]) => <tr key={en}><th scope="row">{ar ? arabic : en}</th><td><bdi>{before}</bdi></td><td><bdi>{after}</bdi></td></tr>)}</tbody></table></div>
    <label>{ar ? "سبب التصحيح" : "Correction reason"}<textarea required minLength={3} defaultValue={ar ? "تصحيح قيمة الشحن وفق الدليل البديل" : "Correct freight amount from replacement proof"} style={{ display: "block", minHeight: 96, width: "100%" }} /></label>
    <p>{ar ? "الدليل الأصلي غير قابل للتغيير:" : "Immutable original evidence:"} <bdi>EVIDENCE-ORIGINAL-0007</bdi></p><p>{ar ? "الدليل البديل غير قابل للتغيير:" : "Immutable replacement evidence:"} <bdi>EVIDENCE-REPLACEMENT-0008</bdi></p>
    <button type="button" data-operation-id="applyApprovedExpenseCorrection">{ar ? "تطبيق التصحيح المعتمد" : "Apply approved correction"}</button>
  </section>;
}
