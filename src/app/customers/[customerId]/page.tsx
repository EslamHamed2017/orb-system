import { redirect } from "next/navigation";

type Query = { locale?: string };
export default async function CustomerPage({ searchParams }: { readonly params: Promise<{ customerId: string }>; readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  redirect(`/masters/customers?locale=${query.locale === "ar" ? "ar" : "en"}`);
}
