import type { NavigationDestination } from "./permission-aware-access";

/**
 * The app's menu, laid out like QuickBooks Online:
 *   side menu — Home, Sales, Expenses, Projects, Reports
 *   top bar  — "+ New" (create anything), the gear (company settings, lists, tools, users)
 * Sales and Expenses open their first page and show their pages as tabs, like QuickBooks.
 */
export type Locale = "en" | "ar";
export type IconName = "today" | "projects" | "finance" | "expenses" | "reports";

export interface SubPage { readonly key: string; readonly href: string; readonly en: string; readonly ar: string; readonly access: readonly NavigationDestination[]; readonly also?: readonly string[] }
export interface Section { readonly key: "home" | "sales" | "expenses" | "projects" | "reports"; readonly en: string; readonly ar: string; readonly icon: IconName; readonly href?: string; readonly access: readonly NavigationDestination[]; readonly pages?: readonly SubPage[]; readonly prefixes?: readonly string[] }

export const SECTIONS: readonly Section[] = Object.freeze([
  { key: "home", en: "Home", ar: "الرئيسية", icon: "today", href: "/", access: ["today"] },
  { key: "sales", en: "Sales", ar: "المبيعات", icon: "finance", access: ["accounts", "customers", "products"], pages: [
    { key: "sales-invoices", href: "/accounts/sales-invoices", en: "Invoices", ar: "الفواتير", access: ["accounts"], also: ["/accounts", "/sales-invoices/"] },
    { key: "collections", href: "/accounts/collections", en: "Payments received", ar: "التحصيلات", access: ["accounts"] },
    { key: "customers", href: "/masters/customers", en: "Customers", ar: "العملاء", access: ["customers"], also: ["/customers/"] },
    { key: "products", href: "/masters/coffee", en: "Products and services", ar: "المنتجات والخدمات", access: ["products"], also: ["/products/"] },
  ] },
  { key: "expenses", en: "Expenses", ar: "المصروفات", icon: "expenses", access: ["accounts", "products"], pages: [
    { key: "expenses", href: "/accounts/expenses", en: "Expenses", ar: "المصروفات", access: ["accounts"] },
    { key: "bills", href: "/accounts/supplier-invoices", en: "Bills", ar: "فواتير الموردين", access: ["accounts"] },
    { key: "bill-payments", href: "/accounts/supplier-payments", en: "Bill payments", ar: "دفعات الموردين", access: ["accounts"] },
    { key: "suppliers", href: "/masters/suppliers", en: "Suppliers", ar: "الموردين", access: ["products", "accounts"], also: ["/suppliers/"] },
  ] },
  { key: "projects", en: "Projects", ar: "المشاريع", icon: "projects", href: "/projects", access: ["projects"], prefixes: ["/projects", "/sales-shipments/", "/supplier-shipments/", "/shipments"] },
  { key: "reports", en: "Reports", ar: "التقارير", icon: "reports", href: "/reports", access: ["reports"], prefixes: ["/reports"] },
]);

/** Gear menu, grouped like QuickBooks' gear: your company, lists, tools. */
export const GEAR: readonly { readonly en: string; readonly ar: string; readonly links: readonly SubPage[] }[] = Object.freeze([
  { en: "Your company", ar: "شركتك", links: [
    { key: "settings", href: "/settings", en: "Account and settings", ar: "الحساب والإعدادات", access: ["settings"] },
    { key: "users", href: "/admin/users", en: "Manage users", ar: "إدارة المستخدمين", access: ["admin"] },
  ] },
  { en: "Lists", ar: "القوائم", links: [
    { key: "products", href: "/masters/coffee", en: "Products and services", ar: "المنتجات والخدمات", access: ["products"] },
    { key: "customers", href: "/masters/customers", en: "Customers", ar: "العملاء", access: ["customers"] },
    { key: "suppliers", href: "/masters/suppliers", en: "Suppliers", ar: "الموردون", access: ["products", "accounts"] },
    { key: "attachments", href: "/attachments", en: "Attachments", ar: "المرفقات", access: ["documents"] },
  ] },
  { en: "Tools", ar: "الأدوات", links: [
    { key: "audit-log", href: "/admin/audit-log", en: "Audit log", ar: "سجل التدقيق", access: ["admin"] },
    { key: "backup", href: "/admin/backup", en: "Backup and restore", ar: "النسخ الاحتياطي والاستعادة", access: ["admin"] },
  ] },
]);

/** "+ New", in QuickBooks' four columns. Items that belong to a project first ask which project. */
export interface NewItem { readonly key: string; readonly en: string; readonly ar: string; readonly href: string; readonly access: readonly NavigationDestination[] }
export const NEW_MENU: readonly { readonly en: string; readonly ar: string; readonly items: readonly NewItem[] }[] = Object.freeze([
  { en: "Customers", ar: "العملاء", items: [
    { key: "sales-contract", en: "Sales contract", ar: "عقد بيع", href: "/projects/new", access: ["projects"] },
    { key: "invoice", en: "Invoice", ar: "فاتورة", href: "/new/invoice", access: ["accounts"] },
    { key: "receive-payment", en: "Receive payment", ar: "استلام دفعة", href: "/new/receive-payment", access: ["accounts"] },
    { key: "customer-refund", en: "Refund to customer", ar: "استرداد للعميل", href: "/new/customer-refund", access: ["accounts"] },
  ] },
  { en: "Suppliers", ar: "الموردين", items: [
    { key: "purchase-contract", en: "Purchase contract", ar: "عقد شراء", href: "/new/purchase-contract", access: ["projects"] },
    { key: "bill", en: "Bill", ar: "فاتورة مورد", href: "/new/bill", access: ["accounts"] },
    { key: "pay-bill", en: "Pay bills", ar: "دفع فواتير الموردين", href: "/new/pay-bill", access: ["accounts"] },
    { key: "expense", en: "Expense", ar: "مصروف", href: "/new/expense", access: ["projects"] },
    { key: "supplier-refund", en: "Refund from supplier", ar: "استرداد من مورد", href: "/new/supplier-refund", access: ["accounts"] },
  ] },
  { en: "Projects", ar: "المشاريع", items: [
    { key: "project", en: "Project", ar: "مشروع", href: "/projects/new", access: ["projects"] },
    { key: "shipment", en: "Shipment", ar: "شحنة", href: "/new/shipment", access: ["shipments"] },
    { key: "claim", en: "Claim", ar: "مطالبة", href: "/new/claim", access: ["projects"] },
  ] },
  { en: "Other", ar: "أخرى", items: [
    { key: "customer", en: "Customer", ar: "عميل", href: "/masters/customers", access: ["customers"] },
    { key: "supplier", en: "Supplier", ar: "مورد", href: "/masters/suppliers", access: ["products"] },
    { key: "product", en: "Product or service", ar: "منتج أو خدمة", href: "/masters/coffee", access: ["products"] },
  ] },
]);

/** Where each project-bound "+ New" item lands once a project is chosen. */
export const NEW_IN_PROJECT: Readonly<Record<string, { readonly en: string; readonly ar: string; readonly path: string }>> = Object.freeze({
  "invoice": { en: "Invoice", ar: "فاتورة", path: "invoices/new" },
  "receive-payment": { en: "Receive payment", ar: "استلام دفعة", path: "money" },
  "customer-refund": { en: "Refund to customer", ar: "استرداد للعميل", path: "money" },
  "purchase-contract": { en: "Purchase contract", ar: "عقد شراء", path: "contracts" },
  "bill": { en: "Bill", ar: "فاتورة مورد", path: "shipments?flow=supplier" },
  "pay-bill": { en: "Pay bills", ar: "دفع فواتير الموردين", path: "money" },
  "expense": { en: "Expense", ar: "مصروف", path: "expenses" },
  "supplier-refund": { en: "Refund from supplier", ar: "استرداد من مورد", path: "money" },
  "shipment": { en: "Shipment", ar: "شحنة", path: "shipments" },
  "claim": { en: "Claim", ar: "مطالبة", path: "claims" },
});

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const pageMatches = (pathname: string, page: SubPage) => under(pathname, page.href) || (page.also ?? []).some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));

export function sectionFor(pathname: string): { section: Section; page: SubPage | null } | null {
  for (const section of SECTIONS) {
    const page = section.pages?.find((item) => pageMatches(pathname, item));
    if (page) return { section, page };
  }
  if (pathname === "/") return { section: SECTIONS[0], page: null };
  for (const section of SECTIONS) if ((section.prefixes ?? []).some((prefix) => pathname.startsWith(prefix))) return { section, page: null };
  return null;
}

export function allowed(access: readonly NavigationDestination[], canOpen: (d: NavigationDestination) => boolean) {
  return access.some(canOpen);
}

/** The first page of a section the user may open — the section's link goes there. */
export function sectionHref(section: Section, canOpen: (d: NavigationDestination) => boolean): string | null {
  if (section.href) return allowed(section.access, canOpen) ? section.href : null;
  return section.pages?.find((page) => allowed(page.access, canOpen))?.href ?? null;
}
