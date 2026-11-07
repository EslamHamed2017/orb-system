import { DatasetHistory, type DatasetHistoryRow } from "./DatasetHistory";
import { ExecutionActions, type ShipmentKind, type ShipmentUiState } from "./ExecutionActions";
import { QuantitySummary } from "./QuantitySummary";

type DemoState = "tolerance" | "stale" | "replay" | "post-transit" | null;
const history: readonly DatasetHistoryRow[] = [
  { revision: 1, datasetId: "DATASET-0001", hash: "6f7a…91c2", reason: "Initial dataset", actor: "Operations user", changedAt: "2026-11-05T08:00:00Z", approvalId: null, invalidatedApprovalIds: ["APR-OLD-1"] },
  { revision: 2, datasetId: "DATASET-0002", hash: "98da…5e40", reason: "Corrected verified weight", actor: "Operations user", changedAt: "2026-11-05T09:15:00Z", approvalId: "APR-CURRENT-2", invalidatedApprovalIds: [] },
];

export function ShipmentWorkspaceCore({ kind, locale, state, demoState }: { readonly kind: ShipmentKind; readonly locale: "en" | "ar"; readonly state: ShipmentUiState; readonly demoState: DemoState }) {
  const ar = locale === "ar", supplier = kind === "supplier";
  const reference = supplier ? "ORB-SUP-0007" : "ORB-SAL-0007";
  const canRevise = state === "draft" || state === "confirmed";
  return <article data-shipment-kind={kind} style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, display: "grid", gap: 16, padding: 16 }}>
    <header>
      <p>{ar ? (supplier ? "شحنة المورد" : "شحنة البيع") : (supplier ? "Supplier dataset workspace" : "Sales dataset workspace")}</p>
      <h2>{ar ? (supplier ? "شحنة المورد" : "شحنة البيع") : (supplier ? "Supplier shipment" : "Sales shipment")}</h2>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <div><dt>{ar ? "مرجع الشحنة" : "Shipment reference"}</dt><dd><bdi>{reference}</bdi></dd></div>
        <div><dt>{ar ? "المشروع" : "Project"}</dt><dd><bdi>ORB-PROJ-DEMO</bdi></dd></div>
        <div><dt>{ar ? "الحالة" : "State"}</dt><dd><bdi>{state.toUpperCase()}</bdi></dd></div>
        <div><dt>{ar ? "الإصدار" : "Version"}</dt><dd><bdi>7</bdi></dd></div>
      </dl>
    </header>

    {!supplier && <label>{ar ? "مصدر المورد الأساسي" : "Primary supplier source"}
      <select aria-label={ar ? "مصدر المورد الأساسي" : "Primary supplier source"} defaultValue="ORB-SUP-0007" style={{ display: "block", minHeight: 48, width: "min(100%, 32rem)" }}>
        <option value="ORB-SUP-0007">ORB-SUP-0007 — {ar ? "مؤكدة ومتوافقة" : "Confirmed and compatible"}</option>
      </select>
      <small>{ar ? "مصدر واحد مؤكد ومتوافق فقط؛ لا توجد تخصيصات متعددة." : "Exactly one confirmed compatible source is bound."}</small>
    </label>}

    {!supplier && <QuantitySummary locale={locale} value={{ contracted: "10,000", confirmed: "6,000", delivered: "2,000", cancelledRejected: "500", remaining: "1,500" }} />}

    {demoState === "tolerance" && !supplier && <section role="alert" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 12, padding: 12 }}>
      <h3>{ar ? "خارج حدود التحمل" : "Outside tolerance"}</h3>
      <p>{ar ? "المسموح: 9,900 إلى 10,100؛ الفعلي: 10,250." : "Allowed: 9,900 to 10,100; actual: 10,250."}</p>
      <p>{ar ? "مراجعة مجموعة البيانات 2 • المصدر ORB-SUP-0007" : "Dataset revision 2 • source ORB-SUP-0007"}</p>
      <button type="button">{ar ? "طلب استثناء" : "Request exception"}</button>
    </section>}

    <section aria-labelledby={`${kind}-history-title`}>
      <h3 id={`${kind}-history-title`}>{ar ? "سجل مجموعة البيانات" : "Dataset history"}</h3>
      {demoState === "tolerance" && !supplier && <p>{ar ? "انتهت الموافقة APR-OLD-1 بعد المراجعة؛ يلزم اعتماد مطابق جديد." : "Approval expired: APR-OLD-1 after revision; a new exact approval is required."}</p>}
      <DatasetHistory rows={history} locale={locale} />
    </section>

    {canRevise && <section aria-labelledby={`${kind}-revision-title`}>
      <h3 id={`${kind}-revision-title`}>{ar ? "مراجعة مجموعة البيانات" : "Revise dataset"}</h3>
      <p>{ar ? "يعرض التدفق الفرق القديم والجديد، ويقبل حقائق مجموعة البيانات فقط مع سبب ودليل اختياري. تنتهي الموافقات وتعود الحالة المؤكدة إلى مسودة." : "The flow shows the old/new diff and accepts dataset facts only, with a reason and optional evidence. Approvals expire and Confirmed resets to Draft."}</p>
      <button type="button">{ar ? "مراجعة مجموعة البيانات" : "Revise dataset"}</button>
    </section>}

    <ExecutionActions kind={kind} state={state} locale={locale} />
  </article>;
}
