const HASH = "6fd3501224e648ccf6cd2af4c01038db779bf31041c7ad17724ca7382e1b65fe";
export function SourceDrilldown({ locale, restricted = false }: { locale: "en" | "ar"; restricted?: boolean }) {
  const ar = locale === "ar", title = ar ? "تفاصيل المصادر" : "Source drill-down";
  return <section role="region" aria-label={title} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16 }}>
    <h2>{title}</h2><p><bdi>PURCHASE-CONTRACT-0007</bdi></p>
    {restricted ? <p role="note">{ar ? "القيمة مقيدة حسب الدور" : "Value restricted by role"}</p> : <p><bdi>USD 700.000000</bdi></p>}
    <p>{ar ? "تجزئة المدخل" : "Input hash"}: <bdi style={{ overflowWrap: "anywhere" }}>{HASH}</bdi></p>
  </section>;
}
