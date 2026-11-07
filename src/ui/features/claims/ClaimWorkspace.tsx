"use client";
import { useEffect } from "react";
import { OutcomeProposalDialog } from "./OutcomeProposalDialog";

type DemoState = "open" | "pending" | "rejected" | "approved" | "resolved";

export function ClaimWorkspace({ locale, demoState }: Readonly<{ locale: "ar" | "en"; demoState: DemoState }>) {
  const ar = locale === "ar";
  useEffect(() => { document.documentElement.dir = ar ? "rtl" : "ltr"; document.documentElement.lang = locale; }, [ar, locale]);
  const claimState = demoState === "resolved" ? (ar ? "تمت التسوية" : "RESOLVED")
    : demoState === "open" ? (ar ? "مفتوحة" : "OPEN") : (ar ? "قيد المراجعة" : "UNDER REVIEW");
  const proposalState = demoState === "approved" ? "approved" : demoState === "rejected" ? "rejected" : "pending";
  const blocked = demoState !== "resolved";
  return <>
    <section role="region" aria-labelledby="open-claim-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
      <h2 id="open-claim-title">{ar ? "فتح مطالبة" : "Open claim"}</h2>
      <form style={{ display: "grid", gap: 12 }}>
        <label>{ar ? "نوع المطالبة" : "Claim type"}<select defaultValue="QUALITY" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="QUANTITY">{ar ? "الكمية" : "Quantity"}</option><option value="WEIGHT">{ar ? "الوزن" : "Weight"}</option><option value="QUALITY">{ar ? "الجودة" : "Quality"}</option><option value="DELIVERY">{ar ? "التسليم" : "Delivery"}</option><option value="PRICE">{ar ? "السعر" : "Price"}</option><option value="DOCUMENT">{ar ? "المستند" : "Document"}</option></select></label>
        <label>{ar ? "الطرف المطالب" : "Claimant"}<select defaultValue="CUSTOMER-0007" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="CUSTOMER-0007">{ar ? "عميل تجريبي" : "Demo Customer"}</option></select></label>
        <label>{ar ? "الطرف المدعى عليه" : "Respondent"}<select defaultValue="SUPPLIER-0004" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="SUPPLIER-0004">{ar ? "مورد تجريبي" : "Demo Supplier"}</option></select></label>
        <label>{ar ? "الوصف" : "Description"}<textarea defaultValue={ar ? "تجاوزت الرطوبة المواصفة المتفق عليها" : "Moisture exceeded the agreed specification"} style={{ display: "block", minHeight: 88, width: "100%" }} /></label>
        <label>{ar ? "الدليل" : "Evidence"}<input defaultValue="EVIDENCE-CLAIM-0007" readOnly style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
        <button type="button">{ar ? "فتح المطالبة" : "Open claim"}</button>
      </form>
    </section>
    <section role="region" aria-labelledby="claim-lifecycle-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
      <h2 id="claim-lifecycle-title">{ar ? "دورة حياة المطالبة" : "Claim lifecycle"}</h2>
      <p><bdi>CLAIM-0007</bdi> · <strong>{claimState}</strong> · {ar ? "جودة" : "QUALITY"}</p>
      {demoState === "open" && <button type="button">{ar ? "نقل إلى المراجعة" : "Move to review"}</button>}
      {(demoState === "pending" || demoState === "rejected" || demoState === "approved") && <button type="button">{ar ? "اقتراح النتيجة" : "Propose outcome"}</button>}
    </section>
    {(demoState === "pending" || demoState === "rejected" || demoState === "approved") && <OutcomeProposalDialog locale={locale} state={proposalState} />}
    {blocked && <section role="region" aria-labelledby="claim-blocker-title" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16 }}><h2 id="claim-blocker-title">{ar ? "مانع الإغلاق النهائي" : "Final close blocker"}</h2><p><bdi>CLAIM-0007</bdi> · {ar ? "يجب أن تصل المطالبة المفتوحة أو قيد المراجعة إلى نتيجة نهائية معتمدة." : `${demoState === "open" ? "OPEN" : "UNDER REVIEW"} claim must reach an approved terminal outcome.`}</p></section>}
  </>;
}
