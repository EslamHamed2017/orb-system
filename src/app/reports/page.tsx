import { ReportsHubPage } from "../../ui/features/reports/ReportsHubPage";
type Query = { readonly locale?: string; readonly role?: string; readonly projectId?: string; readonly from?: string; readonly to?: string };
export default async function ReportsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <ReportsHubPage filter={{ locale: query.locale === "ar" ? "ar" : "en", ...(query.role ? { role: query.role } : {}), ...(query.projectId ? { projectId: query.projectId } : {}), ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) }}/>;
}
