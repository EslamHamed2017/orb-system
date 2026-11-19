import { SystemRolesPage } from "../../../ui/features/admin/SystemRolesPage";
type Query = { locale?: string; q?: string };
export default async function RolesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <SystemRolesPage locale={query.locale === "ar" ? "ar" : "en"} query={query.q ?? ""}/>;
}
