import { ProjectSupplierInvoicesPage } from "../../../ui/features/accounts/ProjectSupplierInvoicesPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function SupplierInvoicesPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const projectId = query.projectId?.trim() || undefined;
  return <ProjectSupplierInvoicesPage locale={locale} projectId={projectId} canUpload={query.role !== "finance-viewer"} />;
}
