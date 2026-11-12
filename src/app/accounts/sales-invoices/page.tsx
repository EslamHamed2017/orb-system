import { ProjectSalesInvoicesPage } from "../../../ui/features/accounts/ProjectSalesInvoicesPage";

type Query = { readonly locale?: string; readonly projectId?: string };
export default async function SalesInvoicesPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const projectId = query.projectId?.trim() || undefined;
  return <ProjectSalesInvoicesPage locale={locale} projectId={projectId} />;
}
