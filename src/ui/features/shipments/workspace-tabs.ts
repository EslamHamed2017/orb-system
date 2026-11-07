export type WorkspaceLocale = "ar" | "en";
export type WorkspaceRole = "owner-admin" | "operations" | "finance-viewer";
export type WorkspaceKind = "sales" | "supplier";

export type WorkspaceTab = Readonly<{
  id: string;
  label: Readonly<Record<WorkspaceLocale, string>>;
  roles: readonly WorkspaceRole[];
}>;

const ALL_ROLES: readonly WorkspaceRole[] = ["owner-admin", "operations", "finance-viewer"];
export const SALES_WORKSPACE_TABS: readonly WorkspaceTab[] = [
  { id: "sales-dataset", label: { en: "Dataset", ar: "مجموعة البيانات" }, roles: ALL_ROLES },
  { id: "sales-route", label: { en: "Route checklist", ar: "قائمة المسار" }, roles: ALL_ROLES },
  { id: "sales-evidence", label: { en: "Evidence", ar: "الدليل" }, roles: ALL_ROLES },
  { id: "sales-documents", label: { en: "Documents", ar: "المستندات" }, roles: ALL_ROLES },
  { id: "sales-settlement", label: { en: "Settlement", ar: "التسوية" }, roles: ALL_ROLES },
  { id: "sales-expense", label: { en: "Expense", ar: "المصروف" }, roles: ALL_ROLES },
  { id: "sales-claims", label: { en: "Claims", ar: "المطالبات" }, roles: ALL_ROLES },
  { id: "sales-closure", label: { en: "Closure", ar: "الإغلاق" }, roles: ALL_ROLES },
] as const;
export const SUPPLIER_WORKSPACE_TABS: readonly WorkspaceTab[] = [
  { id: "supplier-dataset", label: { en: "Dataset & actions", ar: "مجموعة البيانات والإجراءات" }, roles: ALL_ROLES },
  { id: "supplier-evidence", label: { en: "Evidence", ar: "الدليل" }, roles: ALL_ROLES },
  { id: "supplier-invoice-payment", label: { en: "Invoice & payment", ar: "الفاتورة والدفع" }, roles: ALL_ROLES },
  { id: "supplier-statement", label: { en: "Statement", ar: "البيان" }, roles: ALL_ROLES },
] as const;

export function tabsFor(kind: WorkspaceKind, role: WorkspaceRole): readonly WorkspaceTab[] {
  return (kind === "sales" ? SALES_WORKSPACE_TABS : SUPPLIER_WORKSPACE_TABS).filter((tab) => tab.roles.includes(role));
}
