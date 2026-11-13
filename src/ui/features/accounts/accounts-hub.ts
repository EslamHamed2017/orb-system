export type AccountsLocale = "en" | "ar";
export type AccountHubRecordType = "SALES_INVOICE" | "SUPPLIER_INVOICE" | "COLLECTION" | "SUPPLIER_PAYMENT" | "EXPENSE";

export interface AccountHubRecord {
  readonly id: string;
  readonly projectId: string;
  readonly type: AccountHubRecordType;
  readonly occurredOn: string;
  readonly state: string;
  readonly reference: string;
  readonly currency: string;
  readonly amount: string;
  readonly outstandingAmount: string;
}

export interface AccountDestination {
  readonly key: "salesInvoices" | "supplierInvoices" | "collections" | "supplierPayments" | "expenses";
  readonly label: string;
  readonly description: string;
  readonly href: string;
}

const inactiveStates = new Set(["CANCELLED", "REVERSED"]);
const destinationCopy = {
  en: [
    ["salesInvoices", "Sales invoices", "Customer billing and customs documents issued once per sales shipment.", "sales-invoices"],
    ["supplierInvoices", "Supplier invoices", "Supplier commercial documents received as project costs, including consolidated containers.", "supplier-invoices"],
    ["collections", "Collections", "Money received from customers.", "collections"],
    ["supplierPayments", "Supplier payments", "Money paid to each supplier.", "supplier-payments"],
    ["expenses", "Expenses", "Project and transaction operating costs.", "expenses"],
  ],
  ar: [
    ["salesInvoices", "فواتير المبيعات", "فاتورة العميل ووثيقة الشحن التجارية الصادرة مرة واحدة لكل شحنة بيع.", "sales-invoices"],
    ["supplierInvoices", "فواتير الموردين", "المستندات التجارية المستلمة من المورد والمسجلة كتكلفة مشروع دون تكرار.", "supplier-invoices"],
    ["collections", "التحصيلات", "المبالغ المستلمة من العملاء.", "collections"],
    ["supplierPayments", "دفعات الموردين", "المبالغ المدفوعة لكل مورد.", "supplier-payments"],
    ["expenses", "المصروفات", "تكاليف تشغيل المشاريع والمعاملات.", "expenses"],
  ],
} as const;

export function buildAccountDestinations(locale: AccountsLocale): readonly AccountDestination[] {
  return destinationCopy[locale].map(([key, label, description, path]) => Object.freeze({
    key, label, description, href: `/accounts/${path}?locale=${locale}`,
  }));
}

const recordPaths: Readonly<Record<AccountHubRecordType, string>> = Object.freeze({
  SALES_INVOICE: "sales-invoices",
  SUPPLIER_INVOICE: "supplier-invoices",
  COLLECTION: "collections",
  SUPPLIER_PAYMENT: "supplier-payments",
  EXPENSE: "expenses",
});

export function accountRecordHref(type: AccountHubRecordType, locale: AccountsLocale): string {
  return `/accounts/${recordPaths[type]}?locale=${locale}`;
}

export function selectRecentAccountRecords(records: readonly AccountHubRecord[], limit = 5): readonly AccountHubRecord[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("Recent record limit must be a non-negative integer");
  return records.filter((record) => !inactiveStates.has(record.state))
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id))
    .slice(0, limit);
}
