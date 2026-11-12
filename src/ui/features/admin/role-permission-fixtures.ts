import type { PermissionMatrixPermission, PermissionMatrixRole } from "./role-permission-matrix";

export const PERMISSION_CATALOG: readonly PermissionMatrixPermission[] = Object.freeze([
  { code: "screen.projects", nameEn: "Projects screen", nameAr: "شاشة المشاريع", category: "SCREEN", descriptionEn: "Open project workspaces", descriptionAr: "فتح مساحات عمل المشاريع" },
  { code: "screen.accounts", nameEn: "Accounts screen", nameAr: "شاشة الحسابات", category: "SCREEN", descriptionEn: "Open operational Accounts", descriptionAr: "فتح الحسابات التشغيلية" },
  { code: "operation.contracts.edit", nameEn: "Edit contracts", nameAr: "تعديل العقود", category: "OPERATION", descriptionEn: "Create and amend contract lines", descriptionAr: "إنشاء بنود العقود وتعديلها" },
  { code: "operation.contracts.approve", nameEn: "Approve contracts", nameAr: "اعتماد العقود", category: "APPROVAL", descriptionEn: "Approve contract versions", descriptionAr: "اعتماد إصدارات العقود" },
  { code: "operation.shipments.edit", nameEn: "Edit shipments", nameAr: "تعديل الشحنات", category: "OPERATION", descriptionEn: "Create shipment lines and allocations", descriptionAr: "إنشاء بنود الشحنات والتخصيصات" },
  { code: "operation.invoices.issue", nameEn: "Issue invoices", nameAr: "إصدار الفواتير", category: "OPERATION", descriptionEn: "Issue customer and supplier invoices", descriptionAr: "إصدار فواتير العملاء والموردين" },
  { code: "field.finance.read", nameEn: "Read financial values", nameAr: "عرض القيم المالية", category: "SENSITIVE_VALUE", descriptionEn: "Read protected commercial values", descriptionAr: "عرض القيم التجارية المحمية" },
  { code: "field.margin.read", nameEn: "Read margin", nameAr: "عرض هامش الربح", category: "SENSITIVE_VALUE", descriptionEn: "Read project profitability", descriptionAr: "عرض ربحية المشروع" },
  { code: "administration.users", nameEn: "Manage users", nameAr: "إدارة المستخدمين", category: "ADMINISTRATION", descriptionEn: "Create and suspend users", descriptionAr: "إنشاء المستخدمين وإيقافهم" },
  { code: "administration.roles", nameEn: "Manage roles", nameAr: "إدارة الأدوار", category: "ADMINISTRATION", descriptionEn: "Create roles and replace grants", descriptionAr: "إنشاء الأدوار واستبدال الصلاحيات" },
]);

const all = PERMISSION_CATALOG.map(({ code }) => code);
export const ACCESS_ROLES: readonly PermissionMatrixRole[] = Object.freeze([
  { id: "role-owner", code: "OWNER_ADMIN", nameEn: "Owner administrator", nameAr: "مدير المالك", descriptionEn: "Controlled full administration", descriptionAr: "إدارة كاملة ومنضبطة", permissionCodes: all, userCount: 1, system: true },
  { id: "role-operations", code: "OPERATIONS", nameEn: "Operations", nameAr: "العمليات", descriptionEn: "Daily trade execution", descriptionAr: "تنفيذ التجارة اليومية", permissionCodes: ["screen.projects", "operation.contracts.edit", "operation.shipments.edit"], userCount: 1, system: true },
  { id: "role-finance", code: "FINANCE_VIEWER", nameEn: "Finance reviewer", nameAr: "مراجع المالية", descriptionEn: "Operational finance review", descriptionAr: "مراجعة الحسابات التشغيلية", permissionCodes: ["screen.projects", "screen.accounts", "operation.invoices.issue", "field.finance.read", "field.margin.read"], userCount: 1, system: true },
  { id: "role-contract-reviewer", code: "CONTRACT_REVIEWER", nameEn: "Contract reviewer", nameAr: "مراجع العقود", descriptionEn: "Reviews contract versions", descriptionAr: "يراجع إصدارات العقود", permissionCodes: ["screen.projects", "operation.contracts.approve"], userCount: 0, system: false },
]);
