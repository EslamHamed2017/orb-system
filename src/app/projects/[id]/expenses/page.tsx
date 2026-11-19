import { LegacyProjectExpensesDemo } from "../../../../ui/features/projects/LegacyProjectExpensesDemo";
import { SavedProjectExpenses } from "../../../../ui/features/projects/SavedProjectExpenses";
import { ProjectMoneyWorkspace } from "../../../../ui/features/money/ProjectMoneyWorkspace";
import { isSavedProjectId } from "../../../../ui/features/money/saved-project-id";

type Query = Readonly<{ locale?: string; demoState?: string; role?: string }>;

export default async function ExpensesPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  if (isSavedProjectId(id)) return <ProjectMoneyWorkspace projectId={id} locale={locale} focus="expenses" />;
  if (id === "demo") return <LegacyProjectExpensesDemo id={id} locale={locale} demoState={query.demoState} role={query.role} />;
  return <SavedProjectExpenses id={id} locale={locale} role={query.role?.trim() || undefined} canMutate={query.role !== "finance-viewer"} />;
}
