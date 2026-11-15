import { ProjectMoneyMovementsPage } from "../../../ui/features/accounts/ProjectMoneyMovementsPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function SupplierPaymentsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const projectId = query.projectId?.trim() || undefined;
  return <ProjectMoneyMovementsPage locale={locale} projectId={projectId} type="SUPPLIER_PAYMENT" canUpload={query.role !== "finance-viewer"} />;
}
