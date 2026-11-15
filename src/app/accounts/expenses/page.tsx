import { ProjectExpensesPage } from "../../../ui/features/accounts/ProjectExpensesPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function ExpensesPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const projectId = query.projectId?.trim() || undefined;
  return <ProjectExpensesPage locale={locale} projectId={projectId} canUpload={query.role !== "finance-viewer"} />;
}
