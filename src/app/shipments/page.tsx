import { SavedShipmentsWorkQueue } from "../../ui/features/shipments/SavedShipmentsWorkQueue";

export default async function ShipmentsPage({ searchParams }: { readonly searchParams: Promise<{ locale?: string; role?: string }> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  return <SavedShipmentsWorkQueue locale={locale} role={query.role?.trim() || undefined} />;
}
