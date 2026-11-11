export type ProductMovementDirection = "INBOUND" | "OUTBOUND";
export type ProductMovementDirectionFilter = ProductMovementDirection | "ALL";
export type ProductMovementTransactionType = "SUPPLIER_CONTAINER" | "SALES_SHIPMENT";

export interface ProductMovementHistoryRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly direction: ProductMovementDirection;
  readonly projectId: string;
  readonly projectReference: string;
  readonly projectName: string;
  readonly quantity: string;
  readonly unit: string;
  readonly transactionType: ProductMovementTransactionType;
  readonly transactionId: string;
  readonly transactionReference: string;
  readonly counterpartyName: string;
  readonly contractLineReference: string;
  readonly sourceAllocationCount: number;
}

interface MovementFilters { readonly projectId?: string; readonly direction: ProductMovementDirectionFilter; readonly query: string }
const SCALE = 1_000_000n;
function decimal(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  if (!/^(?:0|[1-9][0-9]*)$/.test(whole) || !/^[0-9]{0,6}$/.test(fraction)) throw new Error("INVALID_MOVEMENT_QUANTITY");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
function format(value: bigint): string {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function summarizeProductMovements(movements: readonly ProductMovementHistoryRecord[]) {
  const units = new Set(movements.map((movement) => movement.unit));
  if (units.size > 1) throw new Error("MIXED_MOVEMENT_UNITS");
  let inbound = 0n;
  let outbound = 0n;
  for (const movement of movements) {
    const quantity = decimal(movement.quantity);
    if (movement.direction === "INBOUND") inbound += quantity;
    else outbound += quantity;
  }
  return Object.freeze({ movementCount: movements.length, projectCount: new Set(movements.map((movement) => movement.projectId)).size, inboundQuantity: format(inbound), outboundQuantity: format(outbound), unit: movements[0]?.unit ?? "kg" });
}

export function filterProductMovements(movements: readonly ProductMovementHistoryRecord[], filters: MovementFilters): readonly ProductMovementHistoryRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return movements.filter((movement) => {
    if (filters.projectId && movement.projectId !== filters.projectId) return false;
    if (filters.direction !== "ALL" && movement.direction !== filters.direction) return false;
    if (!query) return true;
    return [movement.projectReference, movement.projectName, movement.transactionReference, movement.counterpartyName, movement.contractLineReference].some((value) => value.toLocaleLowerCase().includes(query));
  });
}
