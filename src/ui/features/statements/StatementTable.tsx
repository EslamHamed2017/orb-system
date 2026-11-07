type Locale = "en" | "ar";
type Line = { id: string; date: string; description: string; debit: string; credit: string; balance: string; source: string };

const sections: Array<{ currency: string; balance: string; lines: Line[] }> = [
  { currency: "USD", balance: "150.000000", lines: [
    { id: "LINE-USD-1", date: "2026-11-01", description: "Customer invoice", debit: "1200.000000", credit: "0.000000", balance: "1200.000000", source: "CINV-0007" },
    { id: "LINE-USD-2", date: "2026-11-02", description: "Supplier invoice", debit: "0.000000", credit: "700.000000", balance: "500.000000", source: "SUPPLIER-INVOICE-0007" },
    { id: "LINE-USD-3", date: "2026-11-04", description: "Direct expense", debit: "0.000000", credit: "350.000000", balance: "150.000000", source: "EXP-0007" },
  ] },
  { currency: "EUR", balance: "500.000000", lines: [
    { id: "LINE-EUR-1", date: "2026-11-03", description: "Customer invoice", debit: "500.000000", credit: "0.000000", balance: "500.000000", source: "CINV-0008" },
  ] },
];

export function StatementTable({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  return <div style={{ display: "grid", gap: 16 }}>
    {sections.map((section) => {
      const title = ar ? `بيان ${section.currency}` : `${section.currency} statement`;
      return <section key={section.currency} role="region" aria-label={title} style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16, minWidth: 0 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{title}</h2><strong><bdi>{section.currency} {section.balance}</bdi></strong>
        </header>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead><tr>{[ar ? "التاريخ" : "Date", ar ? "الوصف" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد الجاري" : "Running balance", ar ? "المصدر" : "Source"].map((label) => <th key={label} scope="col" style={{ padding: 10, textAlign: "start" }}>{label}</th>)}</tr></thead>
          <tbody>{section.lines.map((line) => <tr key={line.id}>
            <td style={{ padding: 10 }}><bdi>{line.date}</bdi></td><td style={{ padding: 10 }}>{ar ? "قيد تشغيلي" : line.description}</td>
            <td style={{ padding: 10 }}><bdi>{line.debit}</bdi></td><td style={{ padding: 10 }}><bdi>{line.credit}</bdi></td><td style={{ padding: 10 }}><bdi>{line.balance}</bdi></td>
            <td style={{ padding: 10 }}><a href={`/documents/${line.source}`} aria-label={`${ar ? "المصدر" : "Source"} ${line.source}`}><bdi>{line.source}</bdi></a></td>
          </tr>)}</tbody>
        </table></div>
        <p style={{ marginBlockEnd: 0 }}>{ar ? "فرق غير مفسر" : "Unexplained variance"}: <bdi>0.000000</bdi></p>
      </section>;
    })}
  </div>;
}
