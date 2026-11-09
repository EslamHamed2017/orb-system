import s from "../shipments/operations.module.css";
export type ContractChange = { readonly field: string; readonly before: string; readonly after: string };
export function ContractVersionDiff({ changes, locale = "en" }: { readonly changes: readonly ContractChange[]; readonly locale?: "ar" | "en" }) {
  const ar = locale === "ar";
  return <div className={s.tableScroll}><table aria-label={ar ? "مقارنة الإصدار" : "Version comparison"}>
    <thead><tr><th scope="col">{ar ? "الحقل" : "Field"}</th><th scope="col">{ar ? "الإصدار 1" : "Version 1"}</th><th scope="col">{ar ? "الإصدار 2" : "Version 2"}</th></tr></thead>
    <tbody>{changes.map((change) => <tr key={change.field}><th scope="row">{change.field}</th><td><bdi>{change.before}</bdi></td><td><strong><bdi>{change.after}</bdi></strong></td></tr>)}</tbody>
  </table></div>;
}
