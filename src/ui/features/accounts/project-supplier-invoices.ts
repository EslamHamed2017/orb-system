import type { AccountsLocale } from "./accounts-hub";

export interface SupplierInvoiceListItem {
  readonly id: string;
  readonly projectId: string;
  readonly supplierId: string;
  readonly containerId: string;
  readonly occurredOn: string;
  readonly state: string;
  readonly reference: string;
  readonly currency: string;
  readonly amount: string;
  readonly outstandingAmount: string;
}

const inactiveStates = new Set(["CANCELLED", "REVERSED"]);

export function filterProjectSupplierInvoices(
  invoices: readonly SupplierInvoiceListItem[],
  projectId: string,
): readonly SupplierInvoiceListItem[] {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return invoices
    .filter((invoice) => invoice.projectId === selectedProject && !inactiveStates.has(invoice.state))
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
}

export function buildSupplierInvoiceListHref(projectId: string, locale: AccountsLocale): string {
  const selectedProject = projectId.trim();
  if (!selectedProject) throw new TypeError("Project ID is required");
  return `/accounts/supplier-invoices?projectId=${encodeURIComponent(selectedProject)}&locale=${locale}`;
}
