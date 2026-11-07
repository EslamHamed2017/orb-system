// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export const PROFIT_FORMULA_VERSION = "ORB-R1-PROFIT-1";
export type ProfitMeasureName = "expectedMargin" | "committedMargin" | "actualOperationalMargin" | "cashPosition";
export interface FormulaSource { readonly id: string; readonly amount: string; readonly [key: string]: unknown }
function decimal(value: string): DecimalAmount { const parsed = DecimalAmount.parse(value); if (parsed.scale > 6) throw new TypeError("Amounts may have at most six decimal places"); return parsed; }
export function six(value: DecimalAmount): string { const [whole, fraction = ""] = value.toString().split("."); if (fraction.length > 6) throw new TypeError("Calculated amount exceeds six decimal places"); return `${whole}.${fraction.padEnd(6, "0")}`; }
export function total(rows: readonly FormulaSource[]): DecimalAmount { return rows.reduce((sum, row) => sum.add(decimal(row.amount)), DecimalAmount.parse("0")); }
export function expectedMargin(sales: readonly FormulaSource[], purchases: readonly FormulaSource[]): DecimalAmount { return total(sales).subtract(total(purchases)); }
export function committedMargin(customerInvoices: readonly FormulaSource[], supplierInvoices: readonly FormulaSource[]): DecimalAmount { return total(customerInvoices).subtract(total(supplierInvoices)); }
export function actualOperationalMargin(customerInvoices: readonly FormulaSource[], supplierInvoices: readonly FormulaSource[], expenses: readonly FormulaSource[]): DecimalAmount { return committedMargin(customerInvoices, supplierInvoices).subtract(total(expenses)); }
export function cashPosition(movements: readonly (FormulaSource & { readonly kind: string })[]): DecimalAmount {
  return movements.reduce((sum, row) => {
    const value = decimal(row.amount);
    if (row.kind === "CUSTOMER_ADVANCE" || row.kind === "CUSTOMER_RECEIPT" || row.kind === "SUPPLIER_REFUND") return sum.add(value);
    if (row.kind === "CUSTOMER_REFUND" || row.kind === "SUPPLIER_ADVANCE" || row.kind === "SUPPLIER_PAYMENT") return sum.subtract(value);
    return sum;
  }, DecimalAmount.parse("0"));
}
export const PROFIT_FORMULAS = Object.freeze({
  expectedMargin: "sales contracts - purchase contracts",
  committedMargin: "customer invoices - supplier invoices",
  actualOperationalMargin: "customer invoices - supplier invoices - approved expenses",
  cashPosition: "customer cash received + supplier refunds - customer refunds - supplier cash paid",
} satisfies Record<ProfitMeasureName, string>);
