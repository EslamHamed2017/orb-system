import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { ProjectMoneyWorkspace } from "../../../../ui/features/money/ProjectMoneyWorkspace";
type Query = { readonly locale?: string; readonly new?: string };

export default async function MoneyPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  return isSavedProjectId(id) ? <ProjectMoneyWorkspace projectId={id} locale={locale} initialOpen={query.new === "RECEIPT" || query.new === "PAYMENT" || query.new === "REFUND" ? query.new : null} /> : <RetiredBrowserProject locale={locale} />;
}
