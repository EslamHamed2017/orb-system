// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export type StatementType = "customer" | "supplier" | "sales-shipment" | "supplier-shipment" | "project";
export interface StatementEntry {
  readonly id: string; readonly projectId: string; readonly customerId?: string; readonly supplierId?: string;
  readonly salesShipmentId?: string; readonly supplierShipmentId?: string; readonly kind: string; readonly occurredOn: string;
  readonly currency: string; readonly debit: string; readonly credit: string; readonly sourceType: string; readonly sourceId: string;
}

const SUBJECT_FIELD: Record<StatementType, keyof StatementEntry> = {
  customer: "customerId", supplier: "supplierId", "sales-shipment": "salesShipmentId",
  "supplier-shipment": "supplierShipmentId", project: "projectId",
};
function six(value: DecimalAmount): string {
  const [whole, fraction = ""] = value.toString().split(".");
  if (fraction.length > 6) throw new TypeError("Statement amounts may have at most six decimal places");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}
function amount(value: unknown): DecimalAmount {
  if (typeof value !== "string") throw new TypeError("Statement amounts must be exact decimal strings");
  const parsed = DecimalAmount.parse(value);
  if (parsed.scale > 6) throw new TypeError("Statement amounts may have at most six decimal places");
  return parsed;
}
function validateType(value: unknown): asserts value is StatementType {
  if (typeof value !== "string" || !Object.hasOwn(SUBJECT_FIELD, value)) throw new TypeError("Unknown statement type");
}

export function createInMemoryStatementQuery(options: { readonly entries?: readonly StatementEntry[] }) {
  const entries = structuredClone(options.entries ?? []);
  return Object.freeze({
    async getOperationalStatement(input: { readonly statementType: StatementType; readonly subjectId: string; readonly asOf?: string }) {
      validateType(input.statementType);
      if (!input.subjectId) throw new TypeError("subjectId is required");
      const field = SUBJECT_FIELD[input.statementType];
      const selected = entries.filter((entry) => entry[field] === input.subjectId && (!input.asOf || entry.occurredOn <= input.asOf));
      const currencies = [...new Set(selected.map((entry) => entry.currency))].sort();
      const currencySections = currencies.map((currency) => {
        let running = DecimalAmount.parse("0");
        const lines = selected.filter((entry) => entry.currency === currency)
          .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.id.localeCompare(right.id))
          .map((entry) => {
            const debit = amount(entry.debit), credit = amount(entry.credit);
            running = running.add(debit).subtract(credit);
            return Object.freeze({ id: entry.id, kind: entry.kind, occurredOn: entry.occurredOn, debit: six(debit), credit: six(credit),
              runningBalance: six(running), sourceType: entry.sourceType, sourceId: entry.sourceId });
          });
        return Object.freeze({ currency, lines: Object.freeze(lines), balance: six(running), unexplainedVariance: "0.000000" });
      });
      return Object.freeze({ subjectId: input.subjectId, statementType: input.statementType,
        ...(input.asOf ? { asOf: input.asOf } : {}), currencySections: Object.freeze(currencySections) });
    },
  });
}
