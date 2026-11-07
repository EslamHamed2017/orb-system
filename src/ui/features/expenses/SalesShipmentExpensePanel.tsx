export function SalesShipmentExpensePanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="shipment-expenses-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="shipment-expenses-title">{ar ? "مصروفات شحنة البيع" : "Sales shipment expenses"}</h2>
    <p><bdi>ORB-SAL-0007</bdi></p><p><bdi>EXP-0007</bdi></p>
    <p>{ar ? "محدد مباشرةً لهذه الشحنة • USD 1,250.00 • معتمد" : "Directly scoped to this shipment · USD 1,250.00 · APPROVED"}</p>
  </section>;
}
