import type { SupplierDirectoryRecord } from "./supplier-directory";

export const SUPPLIERS: readonly SupplierDirectoryRecord[] = Object.freeze([
  { id: "supplier-cedar", reference: "SUP-2026-001", legalNameEn: "Cedar Coffee Exporters", legalNameAr: "سيدار لتصدير القهوة", countryCode: "ET", contactName: "Hana Bekele", email: "hana@cedar.example", phone: "+251 91 000 0001", active: true, projectCount: 3, openInvoiceCount: 2 },
  { id: "supplier-highland", reference: "SUP-2026-002", legalNameEn: "Highland Coffee Cooperative", legalNameAr: "تعاونية قهوة المرتفعات", countryCode: "CO", contactName: "Sofia Ruiz", email: "sofia@highland.example", phone: "+57 300 000 0002", active: true, projectCount: 2, openInvoiceCount: 1 },
  { id: "supplier-savanna", reference: "SUP-2025-014", legalNameEn: "Savanna Green Coffee", legalNameAr: "سافانا للقهوة الخضراء", countryCode: "KE", contactName: "Amani Njoroge", email: "amani@savanna.example", phone: "+254 700 000 003", active: false, projectCount: 1, openInvoiceCount: 0 },
]);
