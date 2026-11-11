import { notFound } from "next/navigation";
import { CustomerDetailPage } from "../../../ui/features/masters/CustomerDetailPage";
import { CUSTOMERS } from "../../../ui/features/masters/customer-fixtures";

type Query = { locale?: string };
export default async function CustomerPage({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<Query> }) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  const customer = CUSTOMERS.find((item) => item.id === customerId);
  if (!customer) notFound();
  return <CustomerDetailPage locale={query.locale === "ar" ? "ar" : "en"} customer={customer}/>;
}
