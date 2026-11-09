export function ExpenseHistory({ locale, applied = false }: Readonly<{ locale: "ar" | "en"; applied?: boolean }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="expense-history-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, overflowX: "auto" }}>
    <h2 id="expense-history-title">{ar ? "سجل المصروفات" : "Expense history"}</h2>
    <table aria-label={ar ? "سجل المصروفات غير القابل للتغيير" : "Immutable expense history"} style={{ minWidth: 760, width: "100%" }}>
      <thead><tr><th>{ar ? "المرجع" : "Reference"}</th><th>{ar ? "الحالة" : "State"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "مرتبط بـ" : "Linked expense"}</th><th>{ar ? "الإجراء" : "Action"}</th></tr></thead>
      <tbody>{applied ? <><tr><th scope="row"><bdi>EXP-0007</bdi></th><td>{ar ? "ملغي" : "CANCELLED"}</td><td><bdi>USD 1,250.00</bdi></td><td><bdi>EXP-0008</bdi></td><td>{ar ? "الأصل محفوظ" : "Original retained"}</td></tr><tr><th scope="row"><bdi>EXP-0008</bdi></th><td>{ar ? "معتمد" : "APPROVED"}</td><td><bdi>USD 1,100.00</bdi></td><td><bdi>EXP-0007</bdi></td><td><button type="button" data-operation-id="submitApprovedExpenseCorrection">{ar ? "تصحيح المصروف" : "Correct expense"}</button></td></tr></> : <tr><th scope="row"><bdi>EXP-0007</bdi></th><td>{ar ? "معتمد" : "APPROVED"}</td><td><bdi>USD 1,250.00</bdi></td><td>—</td><td><button type="button" data-operation-id="submitApprovedExpenseCorrection">{ar ? "تصحيح المصروف" : "Correct expense"}</button></td></tr>}</tbody>
    </table>
  </section>;
}
