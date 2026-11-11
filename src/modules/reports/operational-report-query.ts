// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export const OPERATIONAL_REPORT_TYPES = Object.freeze(["CONTRACT_FULFILLMENT", "ACCOUNTS", "PROJECT_PROFITABILITY"] as const);
export type OperationalReportType = typeof OPERATIONAL_REPORT_TYPES[number];
export interface ReportsPrincipal { readonly userId: string; readonly roles: readonly string[] }
interface BaseRow { readonly id: string; readonly reportType: OperationalReportType; readonly projectId: string; readonly occurredOn: string; readonly reference: string; readonly currency: string }
export interface ContractFulfillmentReportRow extends BaseRow { readonly reportType: "CONTRACT_FULFILLMENT"; readonly contractedQuantity: string; readonly fulfilledQuantity: string; readonly contractedValue: string; readonly fulfilledValue: string }
export interface AccountsReportRow extends BaseRow { readonly reportType: "ACCOUNTS"; readonly accountType: string; readonly amount: string; readonly outstandingAmount: string }
export interface ProjectProfitabilityReportRow extends BaseRow { readonly reportType: "PROJECT_PROFITABILITY"; readonly salesAmount: string; readonly supplierAmount: string; readonly expenseAmount: string }
export type OperationalReportRow = ContractFulfillmentReportRow | AccountsReportRow | ProjectProfitabilityReportRow;

const ALLOWED_ROLES = new Set(["OWNER_ADMIN", "FINANCE_VIEWER"]);
const TYPES = new Set<string>(OPERATIONAL_REPORT_TYPES);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function authorize(principal: ReportsPrincipal): void {
  if (!principal?.userId || !principal.roles.some((role) => ALLOWED_ROLES.has(role))) throw new TypeError("Reports access denied");
}
function date(value: string | undefined, name: string): void {
  if (value === undefined) return;
  if (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new TypeError(`${name} must be an ISO date`);
}
function decimal(value: string): DecimalAmount {
  const parsed = DecimalAmount.parse(value);
  if (parsed.scale > 6 || parsed.isNegative()) throw new TypeError("Report amounts must be non-negative exact decimals");
  return parsed;
}
function six(value: DecimalAmount): string {
  const [whole, fraction = ""] = value.toString().split(".");
  if (fraction.length > 6) throw new TypeError("Report calculation exceeds six decimal places");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}
function total(rows: readonly OperationalReportRow[], field: string): DecimalAmount {
  return rows.reduce((sum, row) => {
    const value = (row as unknown as Record<string, unknown>)[field];
    if (typeof value !== "string") throw new TypeError(`Missing report field: ${field}`);
    return sum.add(decimal(value));
  }, DecimalAmount.parse("0"));
}
function summary(reportType: OperationalReportType, rows: readonly OperationalReportRow[]) {
  if (reportType === "CONTRACT_FULFILLMENT") {
    const contractedQuantity = total(rows, "contractedQuantity"), fulfilledQuantity = total(rows, "fulfilledQuantity");
    const contractedValue = total(rows, "contractedValue"), fulfilledValue = total(rows, "fulfilledValue");
    if (fulfilledQuantity.compare(contractedQuantity) > 0 || fulfilledValue.compare(contractedValue) > 0) throw new TypeError("Fulfillment cannot exceed approved contract totals");
    return Object.freeze({ contractedQuantity: six(contractedQuantity), fulfilledQuantity: six(fulfilledQuantity), remainingQuantity: six(contractedQuantity.subtract(fulfilledQuantity)), contractedValue: six(contractedValue), fulfilledValue: six(fulfilledValue), remainingValue: six(contractedValue.subtract(fulfilledValue)) });
  }
  if (reportType === "ACCOUNTS") return Object.freeze({ amount: six(total(rows, "amount")), outstandingAmount: six(total(rows, "outstandingAmount")) });
  const salesAmount = total(rows, "salesAmount"), supplierAmount = total(rows, "supplierAmount"), expenseAmount = total(rows, "expenseAmount");
  return Object.freeze({ salesAmount: six(salesAmount), supplierAmount: six(supplierAmount), expenseAmount: six(expenseAmount), operationalMargin: six(salesAmount.subtract(supplierAmount).subtract(expenseAmount)) });
}
export function createInMemoryOperationalReportQuery(options: { readonly rows?: readonly OperationalReportRow[] }) {
  const rows = structuredClone(options.rows ?? []);
  return Object.freeze({
    async run(input: { readonly principal: ReportsPrincipal; readonly reportType: OperationalReportType; readonly projectId?: string; readonly from?: string; readonly to?: string }) {
      authorize(input.principal);
      if (!TYPES.has(input.reportType)) throw new TypeError("Unknown operational report type");
      date(input.from, "from"); date(input.to, "to");
      if (input.from && input.to && input.from > input.to) throw new TypeError("Report date range is inverted");
      const selected = rows.filter((row) => row.reportType === input.reportType && (!input.projectId || row.projectId === input.projectId) && (!input.from || row.occurredOn >= input.from) && (!input.to || row.occurredOn <= input.to))
        .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.id.localeCompare(right.id));
      return Object.freeze({ reportType: input.reportType, projectId: input.projectId ?? null, from: input.from ?? null, to: input.to ?? null, items: Object.freeze(structuredClone(selected)), summary: summary(input.reportType, selected) });
    },
  });
}
