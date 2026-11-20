import { ShipmentsQueue } from "../../ui/features/shipments/ShipmentsQueue";

export default async function ShipmentsPage({ searchParams }: { readonly searchParams: Promise<{ locale?: string }> }) {
  const query = await searchParams;
  return <ShipmentsQueue locale={query.locale === "ar" ? "ar" : "en"} />;
}
