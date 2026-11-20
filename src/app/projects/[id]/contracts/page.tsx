import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { ProjectWorkspacePage } from "../../../../ui/features/projects/ProjectWorkspacePage";

type Query = { readonly locale?: string };

export default async function ContractsPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  const decodedId = decodeURIComponent(id);
  return isSavedProjectId(decodedId) ? <ProjectWorkspacePage id={decodedId} locale={locale} view="contracts" /> : <RetiredBrowserProject locale={locale} />;
}
