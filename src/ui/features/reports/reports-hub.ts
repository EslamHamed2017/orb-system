export type ReportsLocale = "ar" | "en";
export interface ReportFilter {
  readonly locale: ReportsLocale;
  readonly role?: string;
  readonly projectId?: string;
  readonly from?: string;
  readonly to?: string;
}
export type ReportDestinationKey = "productMovement" | "contractFulfillment" | "accounts" | "projectProfitability";
export interface ReportDestination {
  readonly key: ReportDestinationKey;
  readonly label: string;
  readonly description: string;
  readonly apiHref: string;
}

const COPY = {
  en: {
    productMovement: ["Product movement", "Trace inbound and outbound product movement across projects without stock balances."],
    contractFulfillment: ["Contract fulfillment", "Compare approved contract quantities and values with partial fulfillment."],
    accounts: ["Accounts", "Review operational invoices, collections, supplier payments and expenses."],
    projectProfitability: ["Project profitability", "Compare sales, supplier costs and approved operational expenses."],
  },
  ar: {
    productMovement: ["حركة المنتج", "تتبع حركة المنتجات الواردة والصادرة عبر المشاريع دون أرصدة مخزون."],
    contractFulfillment: ["تنفيذ العقود", "مقارنة كميات وقيم العقود المعتمدة بالتنفيذ الجزئي."],
    accounts: ["الحسابات", "مراجعة الفواتير والتحصيلات ودفعات الموردين والمصروفات التشغيلية."],
    projectProfitability: ["ربحية المشروع", "مقارنة المبيعات وتكاليف الموردين والمصروفات التشغيلية المعتمدة."],
  },
} as const;

function present(value: string | undefined): value is string { return Boolean(value?.trim()); }
function dataFilters(filter: ReportFilter): URLSearchParams {
  const query = new URLSearchParams();
  if (present(filter.projectId)) query.set("projectId", filter.projectId);
  if (present(filter.from)) query.set("from", filter.from);
  if (present(filter.to)) query.set("to", filter.to);
  return query;
}
function href(path: string, query: URLSearchParams): string {
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}
export function buildReportFilterAction(filter: ReportFilter): string {
  const query = new URLSearchParams({ locale: filter.locale });
  if (present(filter.role)) query.set("role", filter.role);
  return `/reports?${query.toString()}`;
}
export function buildReportDestinations(filter: ReportFilter): readonly ReportDestination[] {
  const query = dataFilters(filter), movementQuery = new URLSearchParams({ locale: filter.locale });
  if (present(filter.role)) movementQuery.set("role", filter.role);
  for (const [key, value] of query) movementQuery.set(key, value);
  const copy = COPY[filter.locale];
  return Object.freeze([
    { key: "productMovement", label: copy.productMovement[0], description: copy.productMovement[1], apiHref: href("/reports/product-movement", movementQuery) },
    { key: "contractFulfillment", label: copy.contractFulfillment[0], description: copy.contractFulfillment[1], apiHref: href("/reports/contract-fulfillment", movementQuery) },
    { key: "accounts", label: copy.accounts[0], description: copy.accounts[1], apiHref: href("/reports/accounts", movementQuery) },
    { key: "projectProfitability", label: copy.projectProfitability[0], description: copy.projectProfitability[1], apiHref: href("/reports/project-profitability", movementQuery) },
  ]);
}
