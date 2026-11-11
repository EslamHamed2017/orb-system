import { notFound } from "next/navigation";
import { SupplierDetailPage } from "../../../ui/features/masters/SupplierDetailPage";
import { SUPPLIERS } from "../../../ui/features/masters/supplier-fixtures";

type Query = { locale?: string };
export default async function SupplierPage({ params, searchParams }: { params: Promise<{ supplierId: string }>; searchParams: Promise<Query> }) {
  const [{ supplierId }, query] = await Promise.all([params, searchParams]);
  const supplier = SUPPLIERS.find((item) => item.id === supplierId);
  if (!supplier) notFound();
  return <SupplierDetailPage locale={query.locale === "ar" ? "ar" : "en"} supplier={supplier}/>;
}
