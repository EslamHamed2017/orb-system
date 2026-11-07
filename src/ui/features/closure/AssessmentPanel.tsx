import { BlockerGroup, type ClosureBlockerView } from "./BlockerGroup";

const BLOCKERS: readonly ClosureBlockerView[] = [
  { code: "SALES_SHIPMENT_NOT_DELIVERED", subject: "ORB-SAL-0007", eligible: true },
  { code: "ROUTE_ITEM_INCOMPLETE", subject: "UAE-IMPORT-CUSTOMS-EVIDENCE", eligible: true },
  { code: "SUPPLIER_BALANCE_OUTSTANDING", subject: "SUPPLIER-INVOICE-0007", eligible: false },
  { code: "CLAIM_INCOMPLETE", subject: "CLAIM-0007", eligible: true },
  { code: "APPROVAL_VERSION_STALE", subject: "APPROVAL-0012", eligible: false },
  { code: "AUDIT_INTEGRITY_FAILED", subject: "AUDIT-CHECK-0014", eligible: false },
  { code: "SECURITY_CONTROL_FAILED", subject: "SECURITY-CHECK-0014", eligible: false },
];
const HASH = "98d81c475f398a8cfeab6913e6181230052c2f702304925db83666039f6c5eb2";

export function AssessmentPanel({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  return <>
    <section role="region" aria-labelledby="closure-assessment-title" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16, minWidth: 0 }}>
      <h2 id="closure-assessment-title">{ar ? "تقييم الإغلاق" : "Closure assessment"}</h2>
      <p><bdi>ASSESSMENT-0014</bdi> · {ar ? "إصدار المشروع 14" : "Project version 14"}</p>
      <p>{ar ? "تجزئة الموانع" : "Blockers hash"}: <bdi style={{ overflowWrap: "anywhere" }}>{HASH}</bdi></p>
      <button type="button">{ar ? "تحديث التقييم" : "Refresh assessment"}</button>
    </section>
    <BlockerGroup locale={locale} blockers={BLOCKERS} />
  </>;
}
