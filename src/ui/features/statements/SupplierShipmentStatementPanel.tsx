export function SupplierShipmentStatementPanel({ locale }: { locale: "en" | "ar" }) {
  const ar = locale === "ar", title = ar ? "بيان شحنة المورد" : "Supplier shipment statement";
  return <section role="region" aria-label={title} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16 }}>
    <h2>{title}</h2><p><strong><bdi>ORB-SUP-0007</bdi></strong></p>
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      <div><dt>{ar ? "الرصيد" : "Balance"}</dt><dd><bdi>USD -700.000000</bdi></dd></div>
      <div><dt>{ar ? "آخر قيد" : "Latest entry"}</dt><dd><bdi>2026-11-01</bdi></dd></div>
    </dl>
    <a href="/documents/SUPPLIER-INVOICE-0007" aria-label={`${ar ? "المصدر" : "Source"} SUPPLIER-INVOICE-0007`}><bdi>{ar ? "المصدر" : "Source"} SUPPLIER-INVOICE-0007</bdi></a>
  </section>;
}
