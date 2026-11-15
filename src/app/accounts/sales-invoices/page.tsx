import { loadProjectSalesInvoices } from "../../../modules/invoices/load-project-sales-invoices";
import { ProjectSalesInvoicesPage } from "../../../ui/features/accounts/ProjectSalesInvoicesPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function SalesInvoicesPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const projectId = query.projectId?.trim() || undefined;
  const databaseAvailable = Boolean(process.env.DATABASE_URL);
  if (!projectId || !databaseAvailable) return <ProjectSalesInvoicesPage locale={locale} projectId={projectId} canUpload={false} invoices={[]} databaseAvailable={databaseAvailable} />;
  const invoices = await loadProjectSalesInvoices(projectId);
  return <ProjectSalesInvoicesPage locale={locale} projectId={projectId} canUpload={query.role !== "finance-viewer"} invoices={invoices} />;
}
