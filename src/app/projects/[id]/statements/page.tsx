import { RetiredBrowserProject } from "../../../../ui/features/projects/RetiredBrowserProject";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";
import { NotOnDatabaseYet } from "../../../../ui/features/projects/NotOnDatabaseYet";
type Query = { readonly locale?: string };

export default async function ProjectStatementsPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  return isSavedProjectId(id) ? <NotOnDatabaseYet locale={locale} projectId={id} current="accounts" title={["Operational statements", "البيانات التشغيلية"]} /> : <RetiredBrowserProject locale={locale} />;
}
