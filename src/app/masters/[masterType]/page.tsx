const NAMES = {
  customers: { en: "Customers", ar: "العملاء", singularEn: "customer", singularAr: "عميل" },
  suppliers: { en: "Suppliers", ar: "الموردون", singularEn: "supplier", singularAr: "مورد" },
  coffee: { en: "Coffee", ar: "القهوة", singularEn: "coffee", singularAr: "قهوة" },
  currencies: { en: "Currencies", ar: "العملات", singularEn: "currency", singularAr: "عملة" },
  "expense-categories": { en: "Expense categories", ar: "فئات المصروفات", singularEn: "category", singularAr: "فئة" },
} as const;

type MasterType = keyof typeof NAMES;
export default async function MasterPage({ params, searchParams }: { params: Promise<{ masterType: string }>; searchParams: Promise<{ locale?: string }> }) {
  const [{ masterType }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  const name = NAMES[masterType as MasterType] ?? NAMES.customers;
  const ar = locale === "ar";
  return <section aria-labelledby="master-title" style={{ display: "grid", gap: 16 }}>
    <header><p>{ar ? "السجلات الأساسية" : "Essential masters"}</p><h1 id="master-title">{name[locale]}</h1></header>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button">{ar ? `إضافة ${name.singularAr}` : `Add ${name.singularEn}`}</button>
      <label>{ar ? "بحث" : "Search"}<input type="search" name="search" style={{ display: "block", minHeight: 48 }} /></label>
    </div>
    <div role="status" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
      <h2>{ar ? "لا توجد سجلات بعد" : "No records yet"}</h2>
      <p>{ar ? "أضف أول سجل أساسي. الأرشفة تحافظ على السجل وتاريخ التدقيق." : "Add the first master record. Archive preserves its record and audit history."}</p>
    </div>
  </section>;
}
