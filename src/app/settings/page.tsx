import { SettingsControlCenterPage } from "../../ui/features/settings/SettingsControlCenterPage";

type Query = { locale?: string; role?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  return <SettingsControlCenterPage locale={locale} canManage={!query.role || query.role === "owner-admin"}/>;
}
