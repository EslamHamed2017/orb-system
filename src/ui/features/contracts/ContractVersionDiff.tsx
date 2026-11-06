export type ContractChange = { readonly field: string; readonly before: string; readonly after: string };
export function ContractVersionDiff({ changes, locale = "en" }: { readonly changes: readonly ContractChange[]; readonly locale?: "ar" | "en" }) {
  const ar = locale === "ar";
  return <div style={{ overflowX: "auto" }}><table aria-label={ar ? "مقارنة الإصدار" : "Version comparison"} style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>
    <thead><tr><th scope="col">{ar ? "الحقل" : "Field"}</th><th scope="col">{ar ? "قبل" : "Before"}</th><th scope="col">{ar ? "بعد" : "After"}</th></tr></thead>
    <tbody>{changes.map((change) => <tr key={change.field}><th scope="row">{change.field}</th><td><bdi>{change.before}</bdi></td><td><bdi>{change.after}</bdi></td></tr>)}</tbody>
  </table></div>;
}
