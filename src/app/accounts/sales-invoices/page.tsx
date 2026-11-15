import { loadProjectSalesInvoices } from "../../../modules/invoices/load-project-sales-invoices";
import { ProjectSalesInvoicesPage } from "../../../ui/features/accounts/ProjectSalesInvoicesPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function FinanceRegisterRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const projectId = query.projectId?.trim();
  const databaseAvailable = Boolean(process.env.DATABASE_URL);
  if (!projectId || !databaseAvailable) return <ProjectSalesInvoicesPage locale={query.locale === "ar" ? "ar" : "en"} projectId={projectId} canUpload={false} invoices={[]} databaseAvailable={databaseAvailable} />;
  const invoices = await loadProjectSalesInvoices(projectId);
  const canUpload = query.role !== "finance-viewer";
  return <ProjectSalesInvoicesPage locale={query.locale === "ar" ? "ar" : "en"} projectId={projectId} canUpload={canUpload} invoices={invoices} />;
}
