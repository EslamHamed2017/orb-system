export function SupplierShipmentInvoicePaymentPanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="supplier-payment-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="supplier-payment-title">{ar ? "فاتورة مورد والدفع" : "Supplier invoice and payment"}</h2>
    <p><bdi>ORB-SUP-0007</bdi> · <bdi>INV-2026-117</bdi></p>
    <dl style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}><div><dt>{ar ? "مبلغ الفاتورة" : "Invoice total"}</dt><dd><bdi>USD 10,000.00</bdi></dd></div><div><dt>{ar ? "المخصص" : "Allocated"}</dt><dd><bdi>USD 2,500.00</bdi></dd></div><div><dt>{ar ? "المستحق" : "Outstanding"}</dt><dd><bdi>USD 7,500.00</bdi></dd></div></dl>
  </section>;
}
