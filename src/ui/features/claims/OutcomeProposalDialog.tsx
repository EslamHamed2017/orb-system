type ProposalState = "pending" | "rejected" | "approved";

export function OutcomeProposalDialog({ locale, state }: Readonly<{ locale: "ar" | "en"; state: ProposalState }>) {
  const ar = locale === "ar";
  const approval = state === "approved" ? (ar ? "معتمدة" : "APPROVED") : state === "rejected" ? (ar ? "مرفوضة" : "REJECTED") : (ar ? "قيد الانتظار" : "PENDING");
  return <section role="region" aria-labelledby="outcome-proposal-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
    <h2 id="outcome-proposal-title">{ar ? "اقتراح النتيجة" : "Outcome proposal"}</h2>
    <p>{ar ? `الموافقة: ${approval}` : `Approval: ${approval}`}</p>
    <p>{ar ? "إصدار المطالبة 2 · التجزئة الدقيقة" : "Claim version 2 · exact subject hash"}: <bdi style={{ overflowWrap: "anywhere" }}>6f1d8dc20bb71c8b2be3f59124fbe0e0bd8a748e11994813b28f4c9cc17cbb47</bdi></p>
    <label>{ar ? "النتيجة المقترحة" : "Proposed outcome"}<select defaultValue="RESOLVED" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="RESOLVED">{ar ? "تمت التسوية" : "RESOLVED"}</option><option value="REJECTED">{ar ? "مرفوضة" : "REJECTED"}</option></select></label>
    <label>{ar ? "سبب النتيجة" : "Outcome reason"}<textarea defaultValue={ar ? "تم قبول المطالبة بعد مراجعة الجودة" : "Claim accepted after quality review"} readOnly style={{ display: "block", minHeight: 88, width: "100%" }} /></label>
    <label>{ar ? "دليل النتيجة" : "Outcome evidence"}<input defaultValue="EVIDENCE-OUTCOME-0008" readOnly style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
    {state === "rejected" && <p role="status">{ar ? "رُفض الاقتراح؛ تبقى المطالبة قيد المراجعة." : "Proposal rejected; claim remains under review."}</p>}
    {state === "approved" && <button type="button" data-operation-id="applyApprovedClaimOutcome">{ar ? "تطبيق النتيجة المعتمدة" : "Apply approved outcome"}</button>}
  </section>;
}
