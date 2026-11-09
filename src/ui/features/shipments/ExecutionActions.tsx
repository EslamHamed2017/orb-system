export type ShipmentKind = "supplier" | "sales";
export type ShipmentUiState = "draft" | "confirmed" | "in-transit" | "received" | "delivered" | "cancelled" | "rejected";

export function ExecutionActions({ kind, state, locale }: { readonly kind: ShipmentKind; readonly state: ShipmentUiState; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const actions: readonly string[] = state === "draft"
    ? [ar ? "إرسال للموافقة" : "Submit for approval", ar ? "إلغاء الشحنة" : "Cancel shipment"]
    : state === "confirmed"
      ? [ar ? "تحديد قيد النقل" : "Mark in transit", ar ? "رفض الشحنة" : "Reject shipment", ar ? "إلغاء الشحنة" : "Cancel shipment"]
      : state === "in-transit"
        ? [kind === "supplier" ? (ar ? "تحديد مستلمة" : "Mark received") : (ar ? "تحديد مسلمة" : "Mark delivered"), ar ? "رفض الشحنة" : "Reject shipment"]
        : [];
  return <section data-execution-actions aria-labelledby={`${kind}-execution-title`}>
    <h3 id={`${kind}-execution-title`}>{ar ? "إجراءات التنفيذ" : "Execution actions"}</h3>
    <p>{ar ? "كل إجراء يرسل الإصدار الحالي ومفتاح منع التكرار، ويتطلب سبباً ودليلاً أو وقتاً عند الحاجة." : "Every action sends the current version and an idempotency key, and requires reason plus evidence or time when applicable."}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{actions.map((label) => <button key={label} type="button" data-operation-id={kind === "supplier" ? "transitionSupplierShipmentExecution" : "transitionSalesShipmentExecution"}>{label}</button>)}</div>
  </section>;
}
