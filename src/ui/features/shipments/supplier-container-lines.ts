// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../../platform/decimal/index.ts";

export type SupplierContainerLineDraft = {
  readonly id: string;
  readonly supplierId: string;
  readonly supplierName: string;
  readonly purchaseContractId: string;
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
  readonly supplierLotReference: string;
};

export type SupplierContainerSummary = Readonly<{
  lineCount: number;
  supplierCount: number;
  totalQuantity: string;
  totalNetWeight: string;
  totalGrossWeight: string;
  totalBags: number;
  unit: string | null;
  suppliers: readonly Readonly<{ supplierId: string; supplierName: string; lineCount: number; quantity: string; purchaseContractCount: number }>[];
}>;

function decimal(value: string): DecimalAmount | null { try { return DecimalAmount.parse(value); } catch { return null; } }
function positive(value: string): boolean { const amount = decimal(value); return amount !== null && amount.compare(DecimalAmount.parse(0)) === 1; }

export function validateSupplierContainerLines(lines: readonly SupplierContainerLineDraft[]): string[] {
  if (lines.length === 0) return ["LINES_REQUIRED"];
  const errors: string[] = [];
  for (const line of lines) {
    if (!line.supplierId.trim()) errors.push(`SUPPLIER_REQUIRED:${line.id}`);
    if (!line.purchaseContractId.trim() || !line.contractLineVersionId.trim()) errors.push(`APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED:${line.id}`);
    if (!positive(line.quantity)) errors.push(`QUANTITY_MUST_BE_POSITIVE:${line.id}`);
    else {
      const quantity = decimal(line.quantity), remaining = decimal(line.remainingQuantity);
      if (remaining === null || quantity!.compare(remaining) === 1) errors.push(`QUANTITY_EXCEEDS_REMAINING:${line.id}`);
    }
    if (!line.supplierLotReference.trim()) errors.push(`SUPPLIER_LOT_REFERENCE_REQUIRED:${line.id}`);
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

export function calculateSupplierContainerSummary(lines: readonly SupplierContainerLineDraft[]): SupplierContainerSummary {
  let quantity = DecimalAmount.parse(0), net = DecimalAmount.parse(0), gross = DecimalAmount.parse(0), bags = 0;
  const supplierGroups = new Map<string, { name: string; quantity: DecimalAmount; lineCount: number; contracts: Set<string> }>();
  for (const line of lines) {
    const lineQuantity = DecimalAmount.parse(line.quantity);
    quantity = quantity.add(lineQuantity); net = net.add(DecimalAmount.parse(line.netWeight)); gross = gross.add(DecimalAmount.parse(line.grossWeight)); bags += line.bagCount;
    const group = supplierGroups.get(line.supplierId) ?? { name: line.supplierName, quantity: DecimalAmount.parse(0), lineCount: 0, contracts: new Set<string>() };
    group.quantity = group.quantity.add(lineQuantity); group.lineCount += 1; group.contracts.add(line.purchaseContractId); supplierGroups.set(line.supplierId, group);
  }
  const suppliers = [...supplierGroups.entries()].map(([supplierId, group]) => ({ supplierId, supplierName: group.name, lineCount: group.lineCount, quantity: group.quantity.toString(), purchaseContractCount: group.contracts.size }));
  const units = new Set(lines.map((line) => line.unit));
  return { lineCount: lines.length, supplierCount: suppliers.length, totalQuantity: quantity.toString(), totalNetWeight: net.toString(), totalGrossWeight: gross.toString(), totalBags: bags, unit: units.size === 1 ? lines[0]?.unit ?? null : null, suppliers };
}
