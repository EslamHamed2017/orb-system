import { TodayWorkspace } from "../ui/features/dashboard/TodayWorkspace";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const query = await searchParams;
  return <TodayWorkspace locale={query.locale === "ar" ? "ar" : "en"} />;
}
