export function SalesShipmentClaimsPanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <section role="region" aria-labelledby="shipment-claims-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="shipment-claims-title">{ar ? "مطالبات شحنة البيع" : "Sales shipment claims"}</h2>
    <p><bdi>ORB-SAL-0007</bdi></p>
    <table style={{ width: "100%" }}><thead><tr><th>{ar ? "المرجع" : "Reference"}</th><th>{ar ? "النوع والحالة" : "Type and state"}</th></tr></thead><tbody><tr><td><bdi>CLAIM-0007</bdi></td><td>{ar ? "جودة · مفتوحة" : "QUALITY · OPEN"}</td></tr></tbody></table>
  </section>;
}
