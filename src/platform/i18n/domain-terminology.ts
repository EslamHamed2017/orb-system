export type DomainLocale = "en" | "ar";

type DomainTerm = Readonly<{
  en: string;
  ar: string;
  definition: string;
}>;

function term(en: string, ar: string, definition: string): DomainTerm {
  return Object.freeze({ en, ar, definition });
}

export const DOMAIN_TERMINOLOGY = Object.freeze({
  project: term("Project", "مشروع", "The 360-degree workspace that groups every related commercial and operational record."),
  product: term("Product", "منتج", "A traded product or coffee specification; it is not free-stock inventory."),
  salesContract: term("Sales contract", "عقد بيع", "Customer commercial agreement with one or more versioned contract lines."),
  purchaseContract: term("Purchase contract", "عقد شراء", "Supplier commercial agreement with one or more versioned contract lines."),
  contractLine: term("Contract line", "بند عقد", "A versioned product, quantity, price and commercial-data line within a contract."),
  salesShipment: term("Sales shipment", "شحنة بيع", "Customer-facing fulfillment movement against approved sales-contract lines."),
  supplierContainer: term("Supplier container", "حاوية موردين", "Physical inbound container that may consolidate approved purchase-contract lines from multiple suppliers."),
  shipmentLine: term("Shipment line", "بند شحنة", "A partial or complete fulfillment line linked to an exact approved contract-line version."),
  salesInvoice: term("Sales invoice", "فاتورة مبيعات", "The customer invoice and customs/shipping commercial document issued from one sales shipment; never a duplicate invoice."),
  supplierInvoice: term("Supplier invoice", "فاتورة مورد", "The supplier commercial document received as the project cost invoice; never a duplicate invoice."),
  accounts: term("Accounts", "الحسابات", "Operational commercial tracking for invoices, collections, supplier payments and expenses; not a general ledger."),
  collection: term("Collection", "تحصيل", "Money received from a customer."),
  supplierPayment: term("Supplier payment", "دفعة مورد", "Money paid to a supplier."),
  expense: term("Expense", "مصروف", "A project or transaction operational cost."),
  attachment: term("Attachment", "مرفق", "An access-controlled file linked to its source transaction."),
  productMovement: term("Product movement", "حركة منتج", "Cross-project product traceability without stock balance or inventory valuation."),
  remainingQuantity: term("Remaining quantity", "الكمية المتبقية", "Approved contract-line quantity not yet fulfilled by active shipment lines."),
} satisfies Record<string, DomainTerm>);

export type DomainConcept = keyof typeof DOMAIN_TERMINOLOGY;

export function domainTerm(concept: DomainConcept, locale: DomainLocale): string {
  return DOMAIN_TERMINOLOGY[concept][locale];
}

export function localizedDomainTerms(locale: DomainLocale): Readonly<Record<DomainConcept, string>> {
  return Object.freeze(Object.fromEntries(
    (Object.keys(DOMAIN_TERMINOLOGY) as DomainConcept[]).map((concept) => [concept, domainTerm(concept, locale)]),
  )) as Readonly<Record<DomainConcept, string>>;
}
