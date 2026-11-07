export function SalesShipmentClosurePanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  const rows = ar ? [["التنفيذ", "تم التسليم"], ["المالية", "مغلق ماليًا"], ["المستندات", "مكتملة"], ["المطالبات", "قيد المراجعة"]]
    : [["Execution", "DELIVERED"], ["Finance", "FINANCIALLY CLOSED"], ["Documents", "COMPLETE"], ["Claims", "UNDER REVIEW"]];
  return <section role="region" aria-labelledby="shipment-closure-title" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16, minWidth: 0 }}>
    <h2 id="shipment-closure-title">{ar ? "إغلاق شحنة البيع" : "Sales shipment closure"}</h2><p><bdi>ORB-SAL-0007</bdi></p>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(8rem, 1fr) minmax(0, 2fr)", gap: 8 }}>{rows.map(([axis, value]) => <div key={axis} style={{ display: "contents" }}><dt>{axis}</dt><dd style={{ margin: 0 }}>{value}</dd></div>)}</dl>
  </section>;
}
