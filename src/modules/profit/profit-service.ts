import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { canonicalizeJson } from "../../platform/canonical-json/rfc8785.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PROFIT_FORMULAS, PROFIT_FORMULA_VERSION, actualOperationalMargin, cashPosition, committedMargin, expectedMargin, six, type FormulaSource, type ProfitMeasureName } from "./formulas.ts";

type FinancialSource = FormulaSource & { readonly projectId: string; readonly currency: string; readonly kind?: string };
type ExchangeRate = { readonly currency: string; readonly aedRate: string; readonly rateDate: string; readonly source: string };
interface ProfitOptions {
  readonly salesContracts?: readonly FinancialSource[]; readonly purchaseContracts?: readonly FinancialSource[];
  readonly customerInvoices?: readonly FinancialSource[]; readonly supplierInvoices?: readonly FinancialSource[];
  readonly approvedExpenses?: readonly FinancialSource[]; readonly moneyMovements?: readonly FinancialSource[];
  readonly exchangeRates?: readonly ExchangeRate[];
}
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: unknown) => createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
function byProjectCurrency(rows: readonly FinancialSource[], projectId: string, currency: string) { return rows.filter((row) => row.projectId === projectId && row.currency === currency).map(clone); }
function aed(amount: string, rate?: ExchangeRate) {
  if (!rate) return undefined;
  const converted = DecimalAmount.parse(amount).multiply(DecimalAmount.parse(rate.aedRate));
  return Object.freeze({ amount: six(converted), currency: "AED", rate: rate.aedRate, rateDate: rate.rateDate, rateSource: rate.source });
}
export function createInMemoryProfitService(options: ProfitOptions) {
  const data = {
    salesContracts: clone(options.salesContracts ?? []), purchaseContracts: clone(options.purchaseContracts ?? []),
    customerInvoices: clone(options.customerInvoices ?? []), supplierInvoices: clone(options.supplierInvoices ?? []),
    approvedExpenses: clone(options.approvedExpenses ?? []), moneyMovements: clone(options.moneyMovements ?? []),
    exchangeRates: clone(options.exchangeRates ?? []),
  };
  return Object.freeze({
    async getProjectMarginAndCash(projectId: string) {
      const all = [...data.salesContracts, ...data.purchaseContracts, ...data.customerInvoices, ...data.supplierInvoices, ...data.approvedExpenses, ...data.moneyMovements].filter((row) => row.projectId === projectId);
      const currencies = [...new Set(all.map((row) => row.currency))].sort();
      const currencySections = currencies.map((currency) => {
        const sales = byProjectCurrency(data.salesContracts, projectId, currency), purchases = byProjectCurrency(data.purchaseContracts, projectId, currency);
        const customerInvoices = byProjectCurrency(data.customerInvoices, projectId, currency), supplierInvoices = byProjectCurrency(data.supplierInvoices, projectId, currency);
        const expenses = byProjectCurrency(data.approvedExpenses, projectId, currency), movements = byProjectCurrency(data.moneyMovements, projectId, currency);
        const definitions: Array<[ProfitMeasureName, DecimalAmount, FinancialSource[]]> = [
          ["expectedMargin", expectedMargin(sales, purchases), [...sales, ...purchases]],
          ["committedMargin", committedMargin(customerInvoices, supplierInvoices), [...customerInvoices, ...supplierInvoices]],
          ["actualOperationalMargin", actualOperationalMargin(customerInvoices, supplierInvoices, expenses), [...customerInvoices, ...supplierInvoices, ...expenses]],
          ["cashPosition", cashPosition(movements as Array<FinancialSource & { kind: string }>), movements],
        ];
        const rate = data.exchangeRates.find((item) => item.currency === currency);
        const measures = Object.fromEntries(definitions.map(([name, calculated, sources]) => {
          const amount = six(calculated);
          const snapshot = { projectId, currency, measure: name, formulaVersion: PROFIT_FORMULA_VERSION, formula: PROFIT_FORMULAS[name], sources };
          return [name, Object.freeze({ amount, currency, formula: PROFIT_FORMULAS[name], formulaVersion: PROFIT_FORMULA_VERSION,
            inputHash: hash(snapshot), sources: Object.freeze(sources.map(clone)), unexplainedVariance: "0.000000", ...(rate ? { aedEquivalent: aed(amount, rate) } : {}) })];
        }));
        return Object.freeze({ currency, measures: Object.freeze(measures) });
      });
      const measures = currencySections.length === 1 ? currencySections[0].measures : Object.freeze({});
      return Object.freeze({ projectId, measures, currencySections: Object.freeze(currencySections), formulaVersion: PROFIT_FORMULA_VERSION });
    },
  });
}
