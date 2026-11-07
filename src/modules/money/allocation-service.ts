export type AllocationTargetType = "CINV" | "SUPPLIER_INVOICE";

export function assertAllocationTargetType(value: unknown): asserts value is AllocationTargetType {
  if (value !== "CINV" && value !== "SUPPLIER_INVOICE") throw new TypeError("unsupported allocation target");
}

export function allocationKey(type: AllocationTargetType, id: string): string {
  return `${type}:${id}`;
}
