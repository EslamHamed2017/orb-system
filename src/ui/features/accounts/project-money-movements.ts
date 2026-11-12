import type { AccountsLocale } from "./accounts-hub";

export type MoneyMovementType = "COLLECTION" | "SUPPLIER_PAYMENT";

export interface MoneyMovementListItem {
  readonly id: string;
  readonly projectId: string;
  readonly partyId: string;
  readonly type: MoneyMovementType;
  readonly occurredOn: string;
  readonly state: string;
  readonly reference: string;
  readonly currency: string;
  readonly amount: string;
}

const inactiveStates = new Set(["CANCELLED", "REVERSED"]);
const paths: Readonly<Record<MoneyMovementType, string>> = Object.freeze({
  COLLECTION: "collections",
  SUPPLIER_PAYMENT: "supplier-payments",
});

export function filterProjectMoneyMovements(
  movements: readonly MoneyMovementListItem[],
  projectId: string,
  type: MoneyMovementType,
): readonly MoneyMovementListItem[] {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return movements
    .filter((item) => item.projectId === selectedProject && item.type === type && !inactiveStates.has(item.state))
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
}

export function buildMoneyMovementListHref(type: MoneyMovementType, projectId: string, locale: AccountsLocale): string {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return `/accounts/${paths[type]}?projectId=${encodeURIComponent(selectedProject)}&locale=${locale}`;
}
