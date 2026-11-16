import { CustomerDetailPage } from "../../../ui/features/masters/CustomerDetailPage";

type Query = { locale?: string; role?: string };
export default async function CustomerPage({ params, searchParams }: { readonly params: Promise<{ customerId: string }>; readonly searchParams: Promise<Query> }) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  return <CustomerDetailPage customerId={customerId} locale={query.locale === "ar" ? "ar" : "en"} role={query.role}/>;
}
