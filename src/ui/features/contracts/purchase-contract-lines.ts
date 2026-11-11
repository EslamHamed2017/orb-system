// @ts-expect-error Native Node TypeScript tests require source extensions.
import { calculateSalesContractSummary, validateSalesContractLines, type SalesContractLineDraft, type SalesContractSummary } from "./sales-contract-lines.ts";

export type PurchaseContractLineDraft = SalesContractLineDraft;
export type PurchaseContractSummary = SalesContractSummary;

export function validatePurchaseContractLines(lines: readonly PurchaseContractLineDraft[]): string[] {
  return validateSalesContractLines(lines);
}

export function calculatePurchaseContractSummary(lines: readonly PurchaseContractLineDraft[]): PurchaseContractSummary {
  return calculateSalesContractSummary(lines);
}
