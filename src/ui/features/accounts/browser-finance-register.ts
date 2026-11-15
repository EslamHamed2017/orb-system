import type { ProjectRecord } from "../../../modules/projects/daily-projects";

export type BrowserFinanceKind = "supplierInvoices" | "supplierPayments" | "salesInvoices" | "collections" | "expenses";
export type BrowserFinanceState = "awaitingPayment" | "paid" | "awaitingCollection" | "partiallyCollected" | "collected" | "recorded";

export type BrowserFinanceRow = Readonly<{
  kind: BrowserFinanceKind;
  projectId: string;
  projectCode: string;
  projectReference: string;
  customer: string;
  party: string;
  reference: string;
  occurredOn: string;
  amount: string;
  currency: string;
  state: BrowserFinanceState;
  detail?: string;
  taskHref: string;
}>;

export function buildBrowserFinanceRows(projects: readonly ProjectRecord[], kind: BrowserFinanceKind, projectId?: string): BrowserFinanceRow[] {
  const selected = projectId ? projects.filter((project) => project.id === projectId) : projects;
  const rows = selected.flatMap((project): BrowserFinanceRow[] => {
    const common = { kind, projectId: project.id, projectCode: project.code, projectReference: project.reference, customer: project.customer, currency: project.currency } as const;
    const overview = `/projects/${encodeURIComponent(project.id)}/overview`;
    if (kind === "supplierInvoices" && project.supplierInvoice) return [{ ...common, party: project.supplier ?? "", reference: project.supplierInvoice.reference, occurredOn: project.supplierInvoice.invoiceDate, amount: project.supplierInvoice.amount, state: project.supplierPayment ? "paid" : "awaitingPayment", taskHref: `${overview}#supplier-finance` }];
    if (kind === "supplierPayments" && project.supplierPayment) return [{ ...common, party: project.supplier ?? "", reference: project.supplierPayment.reference, occurredOn: project.supplierPayment.paymentDate, amount: project.supplierPayment.amount, state: "recorded", taskHref: `${overview}#supplier-finance` }];
    if (kind === "salesInvoices" && project.customerInvoice) {
      const invoice = moneyUnits(project.customerInvoice.amount);
      const received = (project.customerCollections ?? []).reduce((sum, collection) => sum + moneyUnits(collection.amount), 0n);
      const complete = received === invoice;
      const state: BrowserFinanceState = complete ? "collected" : received > 0n ? "partiallyCollected" : "awaitingCollection";
      return [{ ...common, party: project.customer, reference: project.customerInvoice.reference, occurredOn: project.customerInvoice.invoiceDate, amount: project.customerInvoice.amount, state, detail: complete ? undefined : formatMoneyUnits(invoice - received), taskHref: `${overview}#customer-finance` }];
    }
    if (kind === "collections") return (project.customerCollections ?? []).map((collection) => ({ ...common, party: project.customer, reference: collection.reference, occurredOn: collection.collectionDate, amount: collection.amount, state: "recorded", taskHref: `${overview}#customer-finance` }));
    if (kind === "expenses") return (project.expenses ?? []).map((expense) => ({ ...common, party: expense.vendor, reference: expense.reference, occurredOn: expense.occurredOn, amount: expense.amount, state: "recorded", detail: expense.category, taskHref: `/projects/${encodeURIComponent(project.id)}/expenses` }));
    return [];
  });
  return rows.sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.reference.localeCompare(left.reference));
}

function moneyUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}
function formatMoneyUnits(units: bigint): string {
  const whole = units / 1_000_000n;
  const fraction = String(units % 1_000_000n).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
