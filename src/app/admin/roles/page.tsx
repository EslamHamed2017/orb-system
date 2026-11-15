import { BrowserRolesAdministration } from "../../../ui/features/admin/BrowserRolesAdministration";
type Query = { locale?: string; role?: string };
export default async function RolesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <BrowserRolesAdministration locale={query.locale === "ar" ? "ar" : "en"} canManage={!query.role || query.role === "owner-admin"}/>;
}
