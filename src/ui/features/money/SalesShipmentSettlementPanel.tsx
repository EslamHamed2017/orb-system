export function SalesShipmentSettlementPanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="sales-settlement-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="sales-settlement-title">{ar ? "تسوية شحنة البيع" : "Sales settlement"}</h2><p><bdi>ORB-SAL-0007</bdi></p>
    <dl style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}><div><dt>{ar ? "المفوتر" : "Invoiced"}</dt><dd><bdi>USD 10,000.00</bdi></dd></div><div><dt>{ar ? "المستلم" : "Received"}</dt><dd><bdi>USD 4,000.00</bdi></dd></div><div><dt>{ar ? "الرصيد" : "Balance"}</dt><dd><bdi>USD 6,000.00</bdi></dd></div></dl>
  </section>;
}
