export type SupplierStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

export interface SupplierDirectoryRecord {
  readonly id: string;
  readonly reference: string;
  readonly legalNameEn: string;
  readonly legalNameAr: string;
  readonly countryCode: string;
  readonly contactName: string;
  readonly email: string;
  readonly phone: string;
  readonly active: boolean;
  readonly projectCount: number;
  readonly openInvoiceCount: number;
}

export function summarizeSuppliers(suppliers: readonly SupplierDirectoryRecord[]) {
  return Object.freeze({
    total: suppliers.length,
    active: suppliers.filter((supplier) => supplier.active).length,
    inactive: suppliers.filter((supplier) => !supplier.active).length,
    linkedProjects: suppliers.reduce((total, supplier) => total + supplier.projectCount, 0),
    openInvoices: suppliers.reduce((total, supplier) => total + supplier.openInvoiceCount, 0),
  });
}

export function filterSuppliers(suppliers: readonly SupplierDirectoryRecord[], query: string, status: SupplierStatusFilter) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return suppliers.filter((supplier) => {
    if (status === "ACTIVE" && !supplier.active) return false;
    if (status === "INACTIVE" && supplier.active) return false;
    if (!normalizedQuery) return true;
    return [supplier.reference, supplier.legalNameEn, supplier.legalNameAr, supplier.countryCode, supplier.contactName, supplier.email, supplier.phone]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
