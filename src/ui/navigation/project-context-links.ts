export type ProjectContextDestination = "overview" | "transactions" | "shipments" | "documents" | "reports" | "activity" | "contracts" | "salesShipment" | "supplierContainer" | "accounts" | "expenses" | "claims" | "closure" | "audit";
export type ProjectContextLocale = "ar" | "en";
export const projectContextCopy = {
  en: { breadcrumb:"Breadcrumb",related:"Project workspace",project:"Project",overview:"Overview",transactions:"Transactions",shipments:"Shipments",documents:"Documents",reports:"Project reports",activity:"Activity",contracts:"Contracts",salesShipment:"Sales shipment",supplierContainer:"Supplier container",accounts:"Accounts",expenses:"Expenses",claims:"Claims",closure:"Project closure",audit:"Audit" },
  ar: { breadcrumb:"مسار التنقل",related:"مساحة عمل المشروع",project:"المشروع",overview:"نظرة عامة",transactions:"المعاملات",shipments:"الشحنات",documents:"المستندات",reports:"تقارير المشروع",activity:"النشاط",contracts:"العقود",salesShipment:"شحنة البيع",supplierContainer:"حاوية الموردين",accounts:"الحسابات",expenses:"المصروفات",claims:"المطالبات",closure:"إغلاق المشروع",audit:"التدقيق" },
} as const;
export type ProjectTab = "overview" | "transactions" | "shipments" | "reports" | "documents";

/** Which of the five QuickBooks-style project tabs a page belongs to. */
export function projectTabFor(current: ProjectContextDestination): ProjectTab | null {
  if (current === "overview" || current === "contracts") return "overview";
  if (current === "transactions" || current === "accounts" || current === "expenses" || current === "claims") return "transactions";
  if (current === "shipments" || current === "salesShipment" || current === "supplierContainer") return "shipments";
  if (current === "reports") return "reports";
  if (current === "documents") return "documents";
  return null;
}

/** The project tabs, in QuickBooks order: Overview, Transactions, Shipments, Project reports, Attachments. */
export function buildProjectContextLinks(locale: ProjectContextLocale, projectId: string) {
  const text=projectContextCopy[locale],root=`/projects/${encodeURIComponent(projectId)}`,suffix=`?locale=${locale}`;
  return [
    {key:"overview",label:text.overview,href:`${root}/overview${suffix}`},
    {key:"transactions",label:text.transactions,href:`${root}/transactions${suffix}`},
    {key:"shipments",label:text.shipments,href:`${root}/shipments${suffix}`},
    {key:"reports",label:text.reports,href:`${root}/profit${suffix}`},
    {key:"documents",label:locale==="ar"?"المرفقات":"Attachments",href:`${root}/documents${suffix}`},
  ] as const;
}
