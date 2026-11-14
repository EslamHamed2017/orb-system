import { LegacyProjectExpensesDemo } from "../../../../ui/features/projects/LegacyProjectExpensesDemo";
import { SavedProjectExpenses } from "../../../../ui/features/projects/SavedProjectExpenses";

type Query = Readonly<{ locale?: string; demoState?: string; role?: string }>;

export default async function ExpensesPage({ params, searchParams }: { readonly params: Promise<{ id: string }>; readonly searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "ar" ? "ar" : "en";
  if (id === "demo") return <LegacyProjectExpensesDemo id={id} locale={locale} demoState={query.demoState} role={query.role} />;
  return <SavedProjectExpenses id={id} locale={locale} canMutate={query.role !== "finance-viewer"} />;
}
