"use client";
import { useEffect } from "react";

export function ExpenseForm({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  useEffect(() => { document.documentElement.dir = ar ? "rtl" : "ltr"; document.documentElement.lang = locale; }, [ar, locale]);
  return <section role="region" aria-labelledby="expense-form-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="expense-form-title">{ar ? "تسجيل مصروف مباشر" : "Record direct expense"}</h2>
    <form data-operation-id="createDirectExpense" style={{ display: "grid", gap: 12 }}>
      <label>{ar ? "نطاق المصروف" : "Expense scope"}<select defaultValue="SALES_SHIPMENT" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="PROJECT">{ar ? "المشروع بالكامل" : "Whole Project"}</option><option value="SALES_SHIPMENT">{ar ? "شحنة بيع واحدة" : "One sales shipment"}</option></select></label>
      <label>{ar ? "شحنة البيع" : "Sales shipment"}<select aria-label={ar ? "شحنة البيع" : "Sales shipment"} defaultValue="ORB-SAL-0007" style={{ display: "block", minHeight: 48, width: "100%" }}><option>ORB-SAL-0007</option></select></label>
      <label>{ar ? "المورد" : "Vendor"}<select defaultValue="VENDOR-0004" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="VENDOR-0004">{ar ? "شركة الشحن التجريبية" : "Demo Freight Co."}</option></select></label>
      <label>{ar ? "فئة المصروف" : "Expense category"}<select defaultValue="FREIGHT" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="FREIGHT">{ar ? "الشحن" : "Freight"}</option></select></label>
      <label>{ar ? "المبلغ" : "Amount"}<input type="number" min="0.01" step="0.01" defaultValue="1250.00" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      <label>{ar ? "العملة" : "Currency"}<select defaultValue="USD" style={{ display: "block", minHeight: 48, width: "100%" }}><option>USD</option></select></label>
      <label>{ar ? "دليل المصروف" : "Proof evidence"}<input defaultValue="EVIDENCE-ORIGINAL-0007" readOnly style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      <button type="button" data-operation-id="submitDirectExpense">{ar ? "إرسال المصروف للموافقة" : "Submit expense for approval"}</button>
      <button type="button" data-operation-id="submitApprovedExpenseCorrection" disabled>{ar ? "إرسال تصحيح للموافقة" : "Submit correction for approval"}</button>
      <button type="button" data-operation-id="applyApprovedExpenseCorrection" disabled>{ar ? "تطبيق التصحيح المعتمد" : "Apply approved correction"}</button>
    </form>
  </section>;
}
