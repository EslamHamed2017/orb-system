import { AccountsWorkspace } from "../../../ui/features/accounts/AccountsWorkspace";

type Query = { readonly locale?: string; readonly projectId?: string };

export default async function AccountsRecordsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <AccountsWorkspace locale={query.locale === "ar" ? "ar" : "en"} view="collections" projectId={query.projectId?.trim() || undefined} />;
}
