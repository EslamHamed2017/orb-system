export type DatasetHistoryRow = Readonly<{
  revision: number;
  datasetId: string;
  hash: string;
  reason: string;
  actor: string;
  changedAt: string;
  approvalId: string | null;
  invalidatedApprovalIds: readonly string[];
}>;

export function DatasetHistory({ rows, locale }: { readonly rows: readonly DatasetHistoryRow[]; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  return <div style={{ overflowX: "auto" }}>
    <table aria-label={ar ? "سجل مجموعة البيانات" : "Dataset history"} style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
      <thead><tr>
        <th scope="col">{ar ? "المراجعة" : "Revision"}</th><th scope="col">{ar ? "مجموعة البيانات والتجزئة" : "Dataset and hash"}</th>
        <th scope="col">{ar ? "سبب التغيير" : "Change reason"}</th><th scope="col">{ar ? "المنفذ والوقت" : "Actor and time"}</th>
        <th scope="col">{ar ? "ارتباط الموافقة" : "Approval binding"}</th>
      </tr></thead>
      <tbody>{[...rows].sort((a, b) => a.revision - b.revision).map((row) => <tr key={row.datasetId}>
        <th scope="row"><bdi>{row.revision}</bdi></th>
        <td><bdi>{row.datasetId}</bdi><br /><code><bdi>{row.hash}</bdi></code></td>
        <td>{row.reason}</td><td>{row.actor}<br /><time dateTime={row.changedAt}><bdi>{row.changedAt}</bdi></time></td>
        <td>{row.approvalId ? <bdi>{row.approvalId}</bdi> : (ar ? "لا توجد" : "None")}
          {row.invalidatedApprovalIds.length > 0 && <p>{ar ? "موافقات منتهية: " : "Invalidated approvals: "}<bdi>{row.invalidatedApprovalIds.join(", ")}</bdi></p>}
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}
