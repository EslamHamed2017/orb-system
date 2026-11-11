export type ProjectContextDestination = "overview" | "contracts" | "shipments" | "salesShipment" | "supplierContainer" | "accounts" | "expenses" | "claims" | "closure" | "audit" | "reports";
export type ProjectContextLocale = "ar" | "en";
export const projectContextCopy = {
  en: { breadcrumb: "Breadcrumb", related: "Related project records", project: "Project", overview: "Overview", contracts: "Contracts", shipments: "Shipments", salesShipment: "Sales shipment", supplierContainer: "Supplier container", accounts: "Accounts", expenses: "Expenses", claims: "Claims", closure: "Project closure", audit: "Audit", reports: "Reports" },
  ar: { breadcrumb: "مسار التنقل", related: "سجلات المشروع المرتبطة", project: "المشروع", overview: "نظرة عامة", contracts: "العقود", shipments: "الشحنات", salesShipment: "شحنة البيع", supplierContainer: "حاوية الموردين", accounts: "الحسابات", expenses: "المصروفات", claims: "المطالبات", closure: "إغلاق المشروع", audit: "التدقيق", reports: "التقارير" },
} as const;
export function buildProjectContextLinks(locale: ProjectContextLocale, projectId: string) {
  const text = projectContextCopy[locale], root = `/projects/${encodeURIComponent(projectId)}`, suffix = `?locale=${locale}`;
  return [
    { key: "overview", label: text.overview, href: `${root}/overview${suffix}` },
    { key: "contracts", label: text.contracts, href: `${root}/contracts${suffix}` },
    { key: "supplierContainer", label: text.supplierContainer, href: `${root}/shipments${suffix}#supplier-dataset` },
    { key: "salesShipment", label: text.salesShipment, href: `${root}/shipments${suffix}#sales-dataset` },
    { key: "accounts", label: text.accounts, href: `${root}/money${suffix}` },
    { key: "expenses", label: text.expenses, href: `${root}/expenses${suffix}` },
    { key: "claims", label: text.claims, href: `${root}/claims${suffix}` },
    { key: "audit", label: text.audit, href: `${root}/audit${suffix}` },
    { key: "reports", label: text.reports, href: `${root}/profit${suffix}` },
  ] as const;
}
