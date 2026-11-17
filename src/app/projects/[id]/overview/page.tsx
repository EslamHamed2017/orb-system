import { createInMemoryProjectOverviewQuery, REQUIRED_PROJECT_OVERVIEW_ADAPTERS } from "../../../../modules/projects/project-overview-query";
import { ProjectOverviewSummary } from "../../../../ui/features/projects/ProjectOverviewSummary";
import { SavedProjectDetail } from "../../../../ui/features/projects/SavedProjectDetail";
import { ProjectWorkspacePage } from "../../../../ui/features/projects/ProjectWorkspacePage";
const data: Record<string, unknown> = {
  project: { id: "demo", code: "ORB-P-0001", state: "ACTIVE", version: 7, customerName: "Pilot Customer" },
  shipments: { supplier: { count: 2, quantity: "40.000000", unit: "MT", states: { RECEIVED: 1, IN_TRANSIT: 1 } }, sales: { count: 1, quantity: "20.000000", unit: "MT", states: { IN_TRANSIT: 1 } } },
  routes: { blockers: [{ id: "route", code: "ROUTE_ITEM_INCOMPLETE", href: "/sales-shipments/demo?tab=route" }] }, documents: { blockers: [{ id: "doc", code: "CINV_MISSING", href: "/sales-shipments/demo?tab=documents" }] },
  settlement: { currencySections: [{ currency: "USD", customerCommercialInvoiced: "28500.000000", supplierCommercialInvoiced: "17700.000000", collected: "20000.000000", supplierPaid: "12500.000000", receivable: "8500.000000", payable: "5200.000000", unallocated: "50.000000" }], blockers: [{ id: "money", code: "UNALLOCATED_MONEY", href: "/projects/demo/money" }] },
  expenses: { currencySections: [{ currency: "USD", approved: "25.000000", pending: "5.000000" }], blockers: [{ id: "expense", code: "EXPENSE_PENDING", href: "/projects/demo/expenses" }] },
  claims: { open: 1, blockers: [{ id: "claim", code: "CLAIM_INCOMPLETE", href: "/projects/demo/claims" }] }, closure: { blockers: [{ id: "closure", code: "SALES_SHIPMENT_NOT_DELIVERED", href: "/projects/demo/closure" }] },
  linkedRecords: { contracts: 3, supplierContainers: 2, salesShipments: 1, salesInvoices: 1, supplierInvoices: 2, collections: 1, supplierPayments: 2, expenses: 2, claims: 1, attachments: 4 },
  audit: { eventCount: 9, lastSequenceNo: 9, lastEventHash: "a".repeat(64), continuityVerified: true, href: "/projects/demo/audit" },
  marginAndCash: { currencySections: [{ currency: "USD", measures: { expectedMargin: { amount: "300.000000" }, committedMargin: { amount: "275.000000" }, actualOperationalMargin: { amount: "250.000000" }, cashPosition: { amount: "100.000000" } } }] },
};
const adapters = Object.fromEntries(REQUIRED_PROJECT_OVERVIEW_ADAPTERS.map((name) => [name, async () => structuredClone(data[name])]));
export default async function OverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string; role?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]), locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  if (id !== "demo") {
    const decodedId = decodeURIComponent(id);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decodedId)) return <ProjectWorkspacePage id={decodedId} locale={locale} view="overview" />;
    return <SavedProjectDetail id={decodedId} locale={locale} role={query.role?.trim() || undefined} canMutate={query.role !== "finance-viewer"} />;
  }
  const overview = await createInMemoryProjectOverviewQuery({ adapters }).getProjectOverview({ projectId: id, principal: { userId: "owner-1", roles: ["OWNER_ADMIN"] } });
  return <div dir={ar ? "rtl" : "ltr"}><ProjectOverviewSummary locale={locale} overview={overview} /></div>;
}
