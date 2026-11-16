import type { AccountsLocale } from "./accounts-hub";

export type { SalesInvoiceListItem } from "../../../modules/invoices/load-project-sales-invoices";
import type { SalesInvoiceListItem } from "../../../modules/invoices/load-project-sales-invoices";

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


export function localizeInvoiceState(state: string, locale: AccountsLocale): string {
  if (state === "ISSUED") return locale === "ar" ? "صادرة" : "Issued";
  if (state === "DRAFT") return locale === "ar" ? "مسودة" : "Draft";
  if (state === "PENDING_APPROVAL") return locale === "ar" ? "بانتظار الموافقة" : "Pending approval";
  return state;
}
