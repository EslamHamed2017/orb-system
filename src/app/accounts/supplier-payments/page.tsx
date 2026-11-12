import { ProjectMoneyMovementsPage } from "../../../ui/features/accounts/ProjectMoneyMovementsPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function SupplierPaymentsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <ProjectMoneyMovementsPage locale={query.locale === "ar" ? "ar" : "en"} projectId={query.projectId?.trim() || undefined} type="SUPPLIER_PAYMENT" canUpload={query.role !== "finance-viewer"} />;
}
