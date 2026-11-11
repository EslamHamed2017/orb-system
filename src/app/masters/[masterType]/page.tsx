import { EnterpriseStyles, ErpPageHeader, Kpi } from "../../../ui/features/admin/EnterpriseUx";
import { ProductsMasterPage } from "../../../ui/features/masters/ProductsMasterPage";
import type { ProductStatusFilter } from "../../../ui/features/masters/product-directory";
import { CustomersPage } from "../../../ui/features/masters/CustomersPage";
import type { CustomerStatusFilter } from "../../../ui/features/masters/customer-directory";

const NAMES = {
  customers: { en: "Customers", ar: "العملاء", singularEn: "customer", singularAr: "عميل" },
  suppliers: { en: "Suppliers", ar: "الموردون", singularEn: "supplier", singularAr: "مورد" },
  currencies: { en: "Currencies", ar: "العملات", singularEn: "currency", singularAr: "عملة" },
  "expense-categories": { en: "Expense categories", ar: "فئات المصروفات", singularEn: "category", singularAr: "فئة" },
} as const;
type MasterType = keyof typeof NAMES;
type Query = { locale?: string; q?: string; status?: string };

export default async function MasterPage({ params, searchParams }: { params: Promise<{ masterType: string }>; searchParams: Promise<Query> }) {
  const [{ masterType }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  if (masterType === "customers") {
    const status: CustomerStatusFilter = query.status === "ACTIVE" || query.status === "INACTIVE" ? query.status : "ALL";
    return <CustomersPage locale={locale} query={query.q ?? ""} status={status}/>;
  }
  if (masterType === "coffee") {
    const status: ProductStatusFilter = query.status === "ACTIVE" || query.status === "INACTIVE" ? query.status : "ALL";
    return <ProductsMasterPage locale={locale} query={query.q ?? ""} status={status}/>;
  }
  const name = NAMES[masterType as MasterType] ?? NAMES.customers;
  const ar = locale === "ar";
  return <section aria-labelledby="master-title" dir={ar ? "rtl" : "ltr"} className="orb-erp"><EnterpriseStyles/><ErpPageHeader titleId="master-title" eyebrow={ar ? "السجلات الأساسية" : "Essential masters"} title={name[locale]} description={ar ? "حافظ على مرجع موحد ونظيف للعمليات والتقارير المالية." : "Maintain a clean, shared reference for operations and financial reporting."} meta={<button type="button" data-operation-id="createMasterRecord">{ar ? `إضافة ${name.singularAr}` : `Add ${name.singularEn}`}</button>}/><div className="orb-summary-grid"><Kpi label={ar ? "السجلات النشطة" : "Active records"} value="0"/><Kpi label={ar ? "المؤرشفة" : "Archived"} value="0"/><Kpi label={ar ? "تحتاج مراجعة" : "Needs review"} value="0"/><Kpi label={ar ? "آخر تحديث" : "Last updated"} value="—"/></div><section role="region" aria-labelledby="master-list-title"><div className="orb-section-title"><div><h2 id="master-list-title">{ar ? "دليل السجلات" : "Records directory"}</h2><p className="orb-muted">{ar ? "ابحث أو حدّث أو أرشف بدون فقد سجل التدقيق." : "Search, update or archive without losing audit history."}</p></div><div className="orb-actions"><button type="button" data-operation-id="updateMasterRecord">{ar ? "تحديث السجل" : "Update record"}</button><button type="button">{ar ? "أرشفة السجل" : "Archive record"}</button></div></div><label>{ar ? "بحث في السجلات" : "Search records"}<input type="search" name="search" placeholder={ar ? "اكتب اسماً أو رمزاً…" : "Name or code…"}/></label><div role="status"><h3>{ar ? "لا توجد سجلات بعد" : "No records yet"}</h3><p>{ar ? "أضف أول سجل أساسي. الأرشفة تحافظ على السجل وتاريخ التدقيق." : "Add the first master record. Archive preserves its record and audit history."}</p></div></section></section>;
}
