/** What each open item found by the completion check means, in English and Arabic. */
export const GROUPS: Record<string, [string, string]> = {
  SALES_SHIPMENT_NOT_DELIVERED: ["Customer shipment not delivered", "شحنة العميل لم تُسلَّم"], SUPPLIER_SHIPMENT_NOT_RECEIVED: ["Supplier shipment not received", "شحنة المورد لم تُستلم"],
  SALES_SHIPMENT_NOT_INVOICED: ["Customer shipment not invoiced", "شحنة عميل بدون فاتورة"], SUPPLIER_SHIPMENT_NOT_INVOICED: ["Supplier shipment not invoiced", "شحنة مورد بدون فاتورة"],
  SALES_INVOICE_NOT_ISSUED: ["Sales invoice not issued", "فاتورة مبيعات غير صادرة"], SUPPLIER_INVOICE_NOT_APPROVED: ["Supplier invoice not approved", "فاتورة مورد غير معتمدة"],
  SALES_INVOICE_UNPAID: ["Customer has not paid in full", "العميل لم يسدد بالكامل"], SUPPLIER_INVOICE_UNPAID: ["Supplier not paid in full", "المورد لم يُسدَّد بالكامل"],
  APPROVAL_PENDING: ["Waiting for approval", "بانتظار الاعتماد"], CLAIM_OPEN: ["Claim still open", "مطالبة ما زالت مفتوحة"],
};
