import { AccountsWorkspace } from "../../ui/features/accounts/AccountsWorkspace";

type Query = { readonly locale?: string; readonly projectId?: string };

export default async function AccountsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <AccountsWorkspace locale={query.locale === "ar" ? "ar" : "en"} view="hub" projectId={query.projectId?.trim() || undefined} />;
}
