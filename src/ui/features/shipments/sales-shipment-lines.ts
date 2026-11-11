// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../../platform/decimal/index.ts";

export type SalesShipmentLineDraft = {
  readonly id: string;
  readonly contractLineVersionId: string;
  readonly contractLineReference: string;
  readonly productName: string;
  readonly quantity: string;
  readonly remainingQuantity: string;
  readonly unit: string;
  readonly bagCount: number;
  readonly bagWeight: string;
  readonly netWeight: string;
  readonly grossWeight: string;
  readonly customerPurchaseOrderReference: string | null;
  readonly marksAndNumbers: string | null;
};

export type SalesShipmentSummary = Readonly<{
  lineCount: number; totalQuantity: string; totalNetWeight: string; totalGrossWeight: string; totalBags: number; unit: string | null;
}>;

function decimal(value: string): DecimalAmount | null { try { return DecimalAmount.parse(value); } catch { return null; } }
function positive(value: string): boolean { const amount = decimal(value); return amount !== null && amount.compare(DecimalAmount.parse(0)) === 1; }

export function validateSalesShipmentLines(lines: readonly SalesShipmentLineDraft[]): string[] {
  if (lines.length === 0) return ["LINES_REQUIRED"];
  const errors: string[] = [];
  for (const line of lines) {
    if (!line.contractLineVersionId.trim()) errors.push(`APPROVED_CONTRACT_LINE_REQUIRED:${line.id}`);
    if (!positive(line.quantity)) errors.push(`QUANTITY_MUST_BE_POSITIVE:${line.id}`);
    else {
      const quantity = decimal(line.quantity), remaining = decimal(line.remainingQuantity);
      if (remaining === null || quantity!.compare(remaining) === 1) errors.push(`QUANTITY_EXCEEDS_REMAINING:${line.id}`);
    }
    if (!Number.isSafeInteger(line.bagCount) || line.bagCount < 1) errors.push(`BAG_COUNT_MUST_BE_POSITIVE:${line.id}`);
    for (const [field, value] of [["BAG_WEIGHT", line.bagWeight], ["NET_WEIGHT", line.netWeight], ["GROSS_WEIGHT", line.grossWeight]] as const)
      if (!positive(value)) errors.push(`${field}_MUST_BE_POSITIVE:${line.id}`);
  }
  const seen = new Set<string>();
  for (const id of lines.map((line) => line.contractLineVersionId).filter(Boolean)) {
    if (seen.has(id)) errors.push(`CONTRACT_LINE_VERSION_DUPLICATE:${id}`);
    seen.add(id);
  }
  if (new Set(lines.map((line) => line.unit)).size > 1) errors.push("MIXED_QUANTITY_UNITS");
  return errors;
}

export function calculateSalesShipmentSummary(lines: readonly SalesShipmentLineDraft[]): SalesShipmentSummary {
  let quantity = DecimalAmount.parse(0), net = DecimalAmount.parse(0), gross = DecimalAmount.parse(0), bags = 0;
  for (const line of lines) { quantity = quantity.add(DecimalAmount.parse(line.quantity)); net = net.add(DecimalAmount.parse(line.netWeight)); gross = gross.add(DecimalAmount.parse(line.grossWeight)); bags += line.bagCount; }
  const units = new Set(lines.map((line) => line.unit));
  return { lineCount: lines.length, totalQuantity: quantity.toString(), totalNetWeight: net.toString(), totalGrossWeight: gross.toString(), totalBags: bags, unit: units.size === 1 ? lines[0]?.unit ?? null : null };
}

export function remainingAfterShipment(line: Pick<SalesShipmentLineDraft, "remainingQuantity" | "quantity">): string {
  return DecimalAmount.parse(line.remainingQuantity).subtract(DecimalAmount.parse(line.quantity)).toString();
}
