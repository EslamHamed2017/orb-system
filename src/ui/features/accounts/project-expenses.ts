import type { AccountsLocale } from "./accounts-hub";

export type ExpenseScopeType = "PROJECT" | "SALES_SHIPMENT" | "SUPPLIER_CONTAINER";

export interface ExpenseListItem {
  readonly id: string;
  readonly projectId: string;
  readonly scopeType: ExpenseScopeType;
  readonly scopeId?: string;
  readonly occurredOn: string;
  readonly state: string;
  readonly reference: string;
  readonly category: string;
  readonly currency: string;
  readonly amount: string;
}

const inactiveStates = new Set(["CANCELLED", "REVERSED"]);

export function filterProjectExpenses(expenses: readonly ExpenseListItem[], projectId: string): readonly ExpenseListItem[] {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return expenses
    .filter((expense) => expense.projectId === selectedProject && !inactiveStates.has(expense.state))
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
}

export function buildExpenseListHref(projectId: string, locale: AccountsLocale): string {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return `/accounts/expenses?projectId=${encodeURIComponent(selectedProject)}&locale=${locale}`;
}
