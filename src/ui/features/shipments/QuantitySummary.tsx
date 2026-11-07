export type QuantitySummaryValue = Readonly<{ contracted: string; confirmed: string; delivered: string; cancelledRejected: string; remaining: string }>;

export function QuantitySummary({ value, locale }: { readonly value: QuantitySummaryValue; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const rows = [
    [ar ? "المتعاقد عليها" : "Contracted", value.contracted],
    [ar ? "المؤكدة" : "Confirmed", value.confirmed],
    [ar ? "المسلمة" : "Delivered", value.delivered],
    [ar ? "الملغاة / المرفوضة" : "Cancelled / rejected", value.cancelledRejected],
    [ar ? "المتبقية" : "Remaining", value.remaining],
  ] as const;
  return <section aria-labelledby="shipment-quantity-title">
    <h3 id="shipment-quantity-title">{ar ? "ملخص الكمية" : "Quantity summary"}</h3>
    <dl style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
      {rows.map(([label, amount]) => <div key={label} style={{ background: "var(--orb-color-surface)", borderRadius: 8, padding: 12 }}><dt>{label}</dt><dd style={{ fontWeight: 650, margin: 0 }}><bdi>{amount}</bdi></dd></div>)}
    </dl>
  </section>;
}
