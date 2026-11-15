import { BrowserFinanceRegisterPage } from "../../../ui/features/accounts/BrowserFinanceRegisterPage";

type Query = { readonly locale?: string; readonly projectId?: string; readonly role?: string };
export default async function FinanceRegisterRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <BrowserFinanceRegisterPage locale={query.locale === "ar" ? "ar" : "en"} kind="collections" projectId={query.projectId?.trim() || undefined} role={query.role?.trim() || undefined} />;
}
