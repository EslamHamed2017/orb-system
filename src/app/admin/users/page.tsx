import { SessionList } from "../../../ui/features/admin/SessionList";
type Query = { locale?: string };
export default async function UsersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams, locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  return <section aria-labelledby="users-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}><header><h1 id="users-title">{ar ? "مستخدمو الإصدار التجريبي والجلسات" : "Pilot users and sessions"}</h1></header><section role="region" aria-labelledby="roles-title" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16 }}><h2 id="roles-title">{ar ? "أدوار الإصدار التجريبي الثابتة" : "Fixed pilot roles"}</h2><ul><li>OWNER_ADMIN</li><li>OPERATIONS</li><li>FINANCE_VIEWER</li></ul><button type="button">{ar ? "تعيين الأدوار الثابتة" : "Assign fixed roles"}</button></section><SessionList locale={locale} /></section>;
}
