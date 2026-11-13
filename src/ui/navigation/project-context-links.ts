export type ProjectContextDestination = "overview" | "transactions" | "shipments" | "documents" | "reports" | "activity" | "contracts" | "salesShipment" | "supplierContainer" | "accounts" | "expenses" | "claims" | "closure" | "audit";
export type ProjectContextLocale = "ar" | "en";
export const projectContextCopy = {
  en: { breadcrumb:"Breadcrumb",related:"Project workspace",project:"Project",overview:"Overview",transactions:"Transactions",shipments:"Shipments",documents:"Documents",reports:"Project reports",activity:"Activity",contracts:"Contracts",salesShipment:"Sales shipment",supplierContainer:"Supplier shipment",accounts:"Accounts",expenses:"Expenses",claims:"Claims",closure:"Project closure",audit:"Audit" },
  ar: { breadcrumb:"مسار التنقل",related:"مساحة عمل المشروع",project:"المشروع",overview:"نظرة عامة",transactions:"المعاملات",shipments:"الشحنات",documents:"المستندات",reports:"تقارير المشروع",activity:"النشاط",contracts:"العقود",salesShipment:"شحنة البيع",supplierContainer:"شحنة المورد",accounts:"الحسابات",expenses:"المصروفات",claims:"المطالبات",closure:"إغلاق المشروع",audit:"التدقيق" },
} as const;
export function buildProjectContextLinks(locale: ProjectContextLocale, projectId: string) {
  const text=projectContextCopy[locale],root=`/projects/${encodeURIComponent(projectId)}`,suffix=`?locale=${locale}`;
  return [
    {key:"overview",label:text.overview,href:`${root}/overview${suffix}`},
    {key:"transactions",label:text.transactions,href:`${root}/transactions${suffix}`},
    {key:"shipments",label:text.shipments,href:`${root}/shipments${suffix}`},
    {key:"documents",label:text.documents,href:`${root}/documents${suffix}`},
    {key:"reports",label:text.reports,href:`${root}/profit${suffix}`},
    {key:"activity",label:text.activity,href:`${root}/audit${suffix}`},
  ] as const;
}
