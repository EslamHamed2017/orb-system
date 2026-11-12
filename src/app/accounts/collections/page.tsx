import { ProjectMoneyMovementsPage } from "../../../ui/features/accounts/ProjectMoneyMovementsPage";

type Query = { readonly locale?: string; readonly projectId?: string };
export default async function CollectionsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <ProjectMoneyMovementsPage locale={query.locale === "ar" ? "ar" : "en"} projectId={query.projectId?.trim() || undefined} type="COLLECTION" />;
}
