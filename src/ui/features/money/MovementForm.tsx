"use client";
import { useEffect } from "react";
export function MovementForm({ locale, refund = false }: Readonly<{ locale: "ar" | "en"; refund?: boolean }>) {
  const ar = locale === "ar";
  useEffect(() => { document.documentElement.dir = ar ? "rtl" : "ltr"; document.documentElement.lang = locale; }, [ar, locale]);
  return <section role="region" aria-labelledby="movement-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
    <h2 id="movement-title">{ar ? "تسجيل حركة مالية" : "Record money movement"}</h2>
    {refund && <p><strong>{ar ? "استرداد العميل" : "Customer refund"}</strong> · {ar ? "حركة تعويضية مرتبطة بالحركة الأصلية" : "Compensating movement linked to the original movement"}</p>}
    <form style={{ display: "grid", gap: 12 }}><label>{ar ? "نوع الحركة" : "Movement kind"}<select defaultValue={refund ? "CUSTOMER_REFUND" : "SUPPLIER_ADVANCE"} style={{ display: "block", minHeight: 48, width: "100%" }}><option value="SUPPLIER_ADVANCE">{ar ? "دفعة مقدمة للمورد" : "Supplier advance"}</option><option value="CUSTOMER_RECEIPT">{ar ? "إيصال عميل" : "Customer receipt"}</option><option value="CUSTOMER_REFUND">{ar ? "استرداد العميل" : "Customer refund"}</option></select></label><label>{ar ? "المبلغ" : "Amount"}<input type="number" min="0.01" step="0.01" defaultValue="10000.00" style={{ display: "block", minHeight: 48, width: "100%" }} /></label><label>{ar ? "العملة" : "Currency"}<select defaultValue="USD" style={{ display: "block", minHeight: 48, width: "100%" }}><option>USD</option></select></label><label>{ar ? "الطرف" : "Party"}<select defaultValue="SUP-DEMO" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="SUP-DEMO">{ar ? "المورد التجريبي" : "Demo supplier"}</option></select></label><button type="button" data-operation-id="recordMoneyMovement">{ar ? "تسجيل الحركة" : "Record movement"}</button><button type="button" data-operation-id="reverseMoneyMovement">{ar ? "عكس الحركة المالية" : "Reverse money movement"}</button></form>
  </section>;
}
