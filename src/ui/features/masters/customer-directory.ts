export type CustomerStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

import type { CustomerDirectoryRecord } from "../../../modules/masters/browser-customer-storage";

export type { CustomerDirectoryRecord };

export function summarizeCustomers(customers: readonly CustomerDirectoryRecord[]) {
  return Object.freeze({
    total: customers.length,
    active: customers.filter((customer) => customer.active).length,
    inactive: customers.filter((customer) => !customer.active).length,
    linkedProjects: customers.reduce((total, customer) => total + customer.projectCount, 0),
    openInvoices: customers.reduce((total, customer) => total + customer.openInvoiceCount, 0),
  });
}

export function filterCustomers(customers: readonly CustomerDirectoryRecord[], query: string, status: CustomerStatusFilter) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return customers.filter((customer) => {
    if (status === "ACTIVE" && !customer.active) return false;
    if (status === "INACTIVE" && customer.active) return false;
    if (!normalizedQuery) return true;
    return [customer.reference, customer.legalNameEn, customer.legalNameAr, customer.countryCode, customer.contactName, customer.email, customer.phone]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
