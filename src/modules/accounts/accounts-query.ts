// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../access/permissions.ts";

export const ACCOUNT_RECORD_TYPES = Object.freeze([
  "SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE",
] as const);
export type AccountRecordType = typeof ACCOUNT_RECORD_TYPES[number];
export interface AccountsPrincipal extends OperationPrincipal {}
export interface AccountRecord {
  readonly id: string; readonly projectId: string; readonly type: AccountRecordType; readonly occurredOn: string;
  readonly state: string; readonly partyId?: string; readonly reference: string; readonly currency: string;
  readonly amount: string; readonly outstandingAmount: string;
}

const INACTIVE_STATES = new Set(["CANCELLED", "REVERSED"]);
const TYPES = new Set<string>(ACCOUNT_RECORD_TYPES);
function authorize(principal: AccountsPrincipal, operationId: "getAccountsSummary" | "listAccountRecords"): void {
  try { assertServerPermission(principal, operationId); } catch { throw new TypeError("Accounts access denied"); }
}
function six(value: DecimalAmount): string {
  const [whole, fraction = ""] = value.toString().split(".");
  if (fraction.length > 6) throw new TypeError("Accounts amounts may have at most six decimal places");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}
function amount(value: string): DecimalAmount {
  const parsed = DecimalAmount.parse(value);
  if (parsed.scale > 6 || parsed.isNegative()) throw new TypeError("Accounts amounts must be non-negative exact decimals");
  return parsed;
}
function total(rows: readonly AccountRecord[], type: AccountRecordType, field: "amount" | "outstandingAmount" = "amount"): DecimalAmount {
  return rows.filter((row) => row.type === type).reduce((sum, row) => sum.add(amount(row[field])), DecimalAmount.parse("0"));
}

export function createInMemoryAccountsQuery(options: { readonly records?: readonly AccountRecord[] }) {
  const records = structuredClone(options.records ?? []);
  const active = (projectId?: string) => records.filter((row) => !INACTIVE_STATES.has(row.state) && (!projectId || row.projectId === projectId));
  return Object.freeze({
    async summary(input: { readonly principal: AccountsPrincipal; readonly projectId?: string }) {
      authorize(input.principal, "getAccountsSummary");
      const selected = active(input.projectId);
      const currencies = [...new Set(selected.map((row) => row.currency))].sort();
      const currencySections = currencies.map((currency) => {
        const rows = selected.filter((row) => row.currency === currency);
        const collections = total(rows, "COLLECTION");
        const supplierPayments = total(rows, "SUPPLIER_PAYMENT");
        const expenses = total(rows, "EXPENSE");
        return Object.freeze({
          currency,
          salesInvoiced: six(total(rows, "SALES_INVOICE")),
          salesOutstanding: six(total(rows, "SALES_INVOICE", "outstandingAmount")),
          supplierInvoiced: six(total(rows, "SUPPLIER_INVOICE")),
          supplierOutstanding: six(total(rows, "SUPPLIER_INVOICE", "outstandingAmount")),
          collections: six(collections), supplierPayments: six(supplierPayments), expenses: six(expenses),
          netOperationalCash: six(collections.subtract(supplierPayments).subtract(expenses)),
        });
      });
      return Object.freeze({ projectId: input.projectId ?? null, recordCount: selected.length, currencySections: Object.freeze(currencySections) });
    },
    async list(input: { readonly principal: AccountsPrincipal; readonly type: AccountRecordType; readonly projectId?: string }) {
      authorize(input.principal, "listAccountRecords");
      if (!TYPES.has(input.type)) throw new TypeError("Unknown account record type");
      const items = active(input.projectId).filter((row) => row.type === input.type)
        .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id));
      return Object.freeze({ projectId: input.projectId ?? null, type: input.type, items: Object.freeze(structuredClone(items)) });
    },
  });
}
