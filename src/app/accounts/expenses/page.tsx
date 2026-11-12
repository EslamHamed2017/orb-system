import { ProjectExpensesPage } from "../../../ui/features/accounts/ProjectExpensesPage";

type Query = { readonly locale?: string; readonly projectId?: string };
export default async function ExpensesRegisterRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <ProjectExpensesPage locale={query.locale === "ar" ? "ar" : "en"} projectId={query.projectId}/>;
}
