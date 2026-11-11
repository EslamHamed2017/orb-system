import type { CustomerDirectoryRecord } from "./customer-directory";

export const CUSTOMERS: readonly CustomerDirectoryRecord[] = Object.freeze([
  { id: "customer-northstar", reference: "CUS-2026-001", legalNameEn: "Northstar Roasters", legalNameAr: "محمصة نورث ستار", countryCode: "AE", contactName: "Maya Haddad", email: "maya@northstar.example", phone: "+971 50 000 0001", active: true, projectCount: 3, openInvoiceCount: 2 },
  { id: "customer-atlas", reference: "CUS-2026-002", legalNameEn: "Atlas Retail", legalNameAr: "أطلس للتجزئة", countryCode: "SA", contactName: "Omar Saleh", email: "omar@atlas.example", phone: "+966 50 000 0002", active: true, projectCount: 1, openInvoiceCount: 1 },
  { id: "customer-harbor", reference: "CUS-2025-014", legalNameEn: "Harbor Coffee", legalNameAr: "هاربور للقهوة", countryCode: "BH", contactName: "Layla Karim", email: "layla@harbor.example", phone: "+973 3000 0003", active: false, projectCount: 2, openInvoiceCount: 0 },
]);
