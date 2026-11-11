// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../../platform/decimal/index.ts";

export type SalesContractLineDraft = {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly currency: string;
  readonly incoterm: string;
  readonly namedPlace: string;
  readonly paymentTerms: string;
  readonly documentTerms: string;
  readonly remainingQuantity?: string;
};

export type SalesContractSummary = {
  readonly lineCount: number;
  readonly totalQuantity: string;
  readonly unit: string | null;
  readonly totalsByCurrency: readonly { readonly currency: string; readonly amount: string }[];
};

function positive(value: string): boolean {
  try { return DecimalAmount.parse(value).compare(DecimalAmount.parse(0)) === 1; } catch { return false; }
}

export function validateSalesContractLines(lines: readonly SalesContractLineDraft[]): string[] {
  if (lines.length === 0) return ["LINES_REQUIRED"];
  const errors: string[] = [];
  for (const line of lines) {
    if (!line.productId.trim()) errors.push(`PRODUCT_REQUIRED:${line.id}`);
    if (!positive(line.quantity)) errors.push(`QUANTITY_MUST_BE_POSITIVE:${line.id}`);
    if (!positive(line.unitPrice)) errors.push(`UNIT_PRICE_MUST_BE_POSITIVE:${line.id}`);
    if (!/^[A-Z]{3}$/.test(line.currency)) errors.push(`CURRENCY_INVALID:${line.id}`);
  }
  if (new Set(lines.map((line) => line.unit)).size > 1) errors.push("MIXED_QUANTITY_UNITS");
  return errors;
}

export function calculateSalesContractSummary(lines: readonly SalesContractLineDraft[]): SalesContractSummary {
  let quantity = DecimalAmount.parse(0);
  const currencies = new Map<string, DecimalAmount>();
  for (const line of lines) {
    quantity = quantity.add(DecimalAmount.parse(line.quantity));
    const value = DecimalAmount.parse(line.quantity).multiply(DecimalAmount.parse(line.unitPrice));
    currencies.set(line.currency, (currencies.get(line.currency) ?? DecimalAmount.parse(0)).add(value));
  }
  const units = new Set(lines.map((line) => line.unit));
  return {
    lineCount: lines.length,
    totalQuantity: quantity.toString(),
    unit: units.size === 1 ? lines[0]?.unit ?? null : null,
    totalsByCurrency: [...currencies].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: amount.toString() })),
  };
}
