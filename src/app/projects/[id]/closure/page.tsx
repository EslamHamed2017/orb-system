import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { ProjectClosureWorkspace } from "../../../../ui/features/closure/ProjectClosureWorkspace";
type Query = { readonly locale?: string };

export default async function ClosurePage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  return isSavedProjectId(id) ? <ProjectClosureWorkspace projectId={id} locale={locale} /> : <RetiredBrowserProject locale={locale} />;
}
