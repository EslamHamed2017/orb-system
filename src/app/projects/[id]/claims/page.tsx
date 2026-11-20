import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { ProjectClaimsWorkspace } from "../../../../ui/features/claims/ProjectClaimsWorkspace";
type Query = { readonly locale?: string };

export default async function ClaimsPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  return isSavedProjectId(id) ? <ProjectClaimsWorkspace projectId={id} locale={locale} /> : <RetiredBrowserProject locale={locale} />;
}
