import { loadProjectSalesInvoices } from "../../modules/invoices/load-project-sales-invoices";
import { AccountsHubPage } from "../../ui/features/accounts/AccountsHubPage";
import type { AccountHubRecord } from "../../ui/features/accounts/accounts-hub";

type Query = { readonly locale?: string };
export default async function AccountsPage({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  const databaseAvailable = Boolean(process.env.DATABASE_URL);
  const invoices = databaseAvailable ? await loadProjectSalesInvoices() : [];
  const records: readonly AccountHubRecord[] = invoices.map((invoice) => ({
    id: invoice.id,
    projectId: invoice.projectId,
    type: "SALES_INVOICE",
    occurredOn: invoice.occurredOn,
    state: invoice.state,
    reference: invoice.reference,
    currency: invoice.currency,
    amount: invoice.amount,
    outstandingAmount: invoice.outstandingAmount,
  }));
  return <AccountsHubPage locale={query.locale === "ar" ? "ar" : "en"} records={records} databaseAvailable={databaseAvailable} />;
}
