export function SupplierInvoicePanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="supplier-invoice-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, display: "grid", gap: 12, padding: 16 }}>
    <header><p>{ar ? "دورة ثابتة مرتبطة بشحنة مورد واحدة" : "Fixed lifecycle for one supplier shipment"}</p><h2 id="supplier-invoice-title">{ar ? "فاتورة المورد" : "Supplier invoice"}</h2></header>
    <form style={{ display: "grid", gap: 12 }}>
      <label>{ar ? "شحنة المورد" : "Supplier shipment"}<select defaultValue="ORB-SUP-0007" style={{ display: "block", minHeight: 48, width: "100%" }}><option>ORB-SUP-0007</option></select></label>
      <label>{ar ? "مرجع الفاتورة" : "Invoice reference"}<input name="invoiceReference" defaultValue="INV-2026-117" required style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      <label>{ar ? "تاريخ الفاتورة" : "Invoice date"}<input type="date" defaultValue="2026-11-07" required style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      <label>{ar ? "المبلغ" : "Invoice amount"}<input type="number" defaultValue="10000.00" min="0.01" step="0.01" required style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      <label>{ar ? "العملة" : "Invoice currency"}<select defaultValue="USD" style={{ display: "block", minHeight: 48, width: "100%" }}><option>USD</option></select></label>
      <label>{ar ? "دليل الفاتورة" : "Invoice evidence"}<input type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "block", minHeight: 48 }} /></label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button">{ar ? "إرسال الفاتورة للموافقة" : "Submit invoice for approval"}</button><button type="button">{ar ? "تأكيد الفاتورة المعتمدة" : "Confirm approved invoice"}</button><button type="button">{ar ? "إلغاء الفاتورة غير المخصصة" : "Cancel unallocated invoice"}</button></div>
    </form>
  </section>;
}
