type Locale = "en" | "ar";
const measures = [
  { key: "expected", en: "Expected margin", ar: "الهامش المتوقع", amount: "USD 500.000000", formula: "sales contracts - purchase contracts", aed: "AED 1,836.250000" },
  { key: "committed", en: "Committed margin", ar: "الهامش الملتزم", amount: "USD 450.000000", formula: "customer invoices - supplier invoices", aed: "AED 1,652.625000" },
  { key: "actual", en: "Actual operational margin", ar: "الهامش التشغيلي الفعلي", amount: "USD 400.000000", formula: "customer invoices - supplier invoices - approved expenses", aed: "AED 1,469.000000" },
  { key: "cash", en: "Cash position", ar: "المركز النقدي", amount: "USD 100.000000", formula: "cash received + refunds - cash paid", aed: "AED 367.250000" },
] as const;
export function ProfitCards({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  return <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
    {measures.map((measure) => { const title = ar ? measure.ar : measure.en; return <section key={measure.key} role="region" aria-label={title} style={{ background: "var(--orb-color-surface-container)", borderRadius: 18, padding: 18, minWidth: 0 }}>
      <h2 style={{ marginBlockStart: 0 }}>{title}</h2><p style={{ fontSize: "1.5rem", fontWeight: 700 }}><bdi>{measure.amount}</bdi></p>
      <p><strong>{ar ? "المعادلة" : "Formula"}:</strong> {measure.formula}</p><p><bdi>ORB-R1-PROFIT-1</bdi></p>
      <p><bdi>{measure.aed}</bdi></p><p><bdi>3.672500 · 2026-11-01 · ORB_RECORDED_RATE</bdi></p>
      <button type="button">{ar ? "تفاصيل المصادر" : "Source drill-down"}</button>
    </section>; })}
  </div>;
}
