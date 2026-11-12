import { AccountsHubPage } from "../../ui/features/accounts/AccountsHubPage";

type Query = { readonly locale?: string };
export default async function AccountsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <AccountsHubPage locale={query.locale === "ar" ? "ar" : "en"}/>;
}
