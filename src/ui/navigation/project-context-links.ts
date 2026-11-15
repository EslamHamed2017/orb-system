export type ProjectContextDestination = "overview" | "transactions" | "shipments" | "documents" | "reports" | "activity" | "contracts" | "salesShipment" | "supplierContainer" | "accounts" | "expenses" | "claims" | "closure" | "audit";
export type ProjectContextLocale = "ar" | "en";
export const projectContextCopy = {
  en: { breadcrumb:"Breadcrumb",related:"Related project records",project:"Project",overview:"Overview",transactions:"Transactions",shipments:"Shipments",documents:"Documents",reports:"Project reports",activity:"Activity",contracts:"Contracts",salesShipment:"Sales shipment",supplierContainer:"Supplier container",accounts:"Accounts",expenses:"Expenses",claims:"Claims",closure:"Project closure",audit:"Audit" },
  ar: { breadcrumb:"مسار التنقل",related:"سجلات المشروع المرتبطة",project:"المشروع",overview:"نظرة عامة",transactions:"المعاملات",shipments:"الشحنات",documents:"المستندات",reports:"تقارير المشروع",activity:"النشاط",contracts:"العقود",salesShipment:"شحنة البيع",supplierContainer:"حاوية الموردين",accounts:"الحسابات",expenses:"المصروفات",claims:"المطالبات",closure:"إغلاق المشروع",audit:"التدقيق" },
} as const;
export function buildProjectContextLinks(locale: ProjectContextLocale, projectId: string) {
  const text=projectContextCopy[locale],root=`/projects/${encodeURIComponent(projectId)}`,suffix=`?locale=${locale}`;
  return [
    {key:"overview",label:text.overview,href:`${root}/overview${suffix}`},
    {key:"contracts",label:text.contracts,href:`${root}/contracts${suffix}`},
    {key:"supplierContainer",label:text.supplierContainer,href:`${root}/shipments${suffix}#supplier-dataset`},
    {key:"salesShipment",label:text.salesShipment,href:`${root}/shipments${suffix}#sales-dataset`},
    {key:"accounts",label:text.accounts,href:`${root}/money${suffix}`},
    {key:"expenses",label:text.expenses,href:`${root}/expenses${suffix}`},
    {key:"claims",label:text.claims,href:`${root}/claims${suffix}`},
    {key:"audit",label:text.audit,href:`${root}/audit${suffix}`},
    {key:"reports",label:text.reports,href:`${root}/profit${suffix}`},
  ] as const;
}
