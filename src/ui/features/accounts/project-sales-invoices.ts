import type { AccountsLocale } from "./accounts-hub";

export interface SalesInvoiceListItem {
  readonly id: string;
  readonly projectId: string;
  readonly shipmentId: string;
  readonly occurredOn: string;
  readonly state: string;
  readonly reference: string;
  readonly currency: string;
  readonly amount: string;
  readonly outstandingAmount: string;
}

const inactiveStates = new Set(["CANCELLED", "REVERSED"]);

export function filterProjectSalesInvoices(
  invoices: readonly SalesInvoiceListItem[],
  projectId: string,
): readonly SalesInvoiceListItem[] {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return invoices
    .filter((invoice) => invoice.projectId === selectedProject && !inactiveStates.has(invoice.state))
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
}

export function buildSalesInvoiceListHref(projectId: string, locale: AccountsLocale): string {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return `/accounts/sales-invoices?projectId=${encodeURIComponent(selectedProject)}&locale=${locale}`;
}
