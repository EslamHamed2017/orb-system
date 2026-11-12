export type ProductMovementReportDirection = "INBOUND" | "OUTBOUND";
export type ProductMovementReportDirectionFilter = ProductMovementReportDirection | "ALL";
export type ProductMovementReportTransactionType = "SUPPLIER_CONTAINER" | "SALES_SHIPMENT";

export interface ProductMovementReportRecord {
  readonly id: string;
  readonly occurredOn: string;
  readonly direction: ProductMovementReportDirection;
  readonly productId: string;
  readonly productReference: string;
  readonly productName: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly quantity: string;
  readonly unit: string;
  readonly transactionType: ProductMovementReportTransactionType;
  readonly transactionId: string;
  readonly transactionReference: string;
  readonly counterpartyName: string;
  readonly contractLineReference: string;
}

export interface ProductMovementReportFilters {
  readonly projectId?: string;
  readonly productId?: string;
  readonly direction: ProductMovementReportDirectionFilter;
  readonly from?: string;
  readonly to?: string;
  readonly query: string;
}

const SCALE = 1_000_000n;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function validateDate(value: string | undefined): void {
  if (value === undefined) return;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new TypeError("INVALID_MOVEMENT_DATE");
}
function decimal(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  if (!/^(?:0|[1-9][0-9]*)$/.test(whole) || !/^[0-9]{0,6}$/.test(fraction)) throw new TypeError("INVALID_MOVEMENT_QUANTITY");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
function format(value: bigint): string {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function buildProductMovementReport(rows: readonly ProductMovementReportRecord[], filters: ProductMovementReportFilters) {
  validateDate(filters.from);
  validateDate(filters.to);
  if (filters.from && filters.to && filters.from > filters.to) throw new TypeError("INVERTED_MOVEMENT_DATE_RANGE");
  const query = filters.query.trim().toLocaleLowerCase();
  const items = rows.filter((row) => {
    if (filters.projectId && row.projectId !== filters.projectId) return false;
    if (filters.productId && row.productId !== filters.productId) return false;
    if (filters.direction !== "ALL" && row.direction !== filters.direction) return false;
    if (filters.from && row.occurredOn < filters.from) return false;
    if (filters.to && row.occurredOn > filters.to) return false;
    return !query || [row.productReference, row.productName, row.projectReference, row.transactionReference, row.counterpartyName, row.contractLineReference].some((value) => value.toLocaleLowerCase().includes(query));
  }).sort((left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.id.localeCompare(right.id));
  const byUnit = new Map<string, { inbound: bigint; outbound: bigint }>();
  for (const row of items) {
    const totals = byUnit.get(row.unit) ?? { inbound: 0n, outbound: 0n };
    const quantity = decimal(row.quantity);
    if (row.direction === "INBOUND") totals.inbound += quantity;
    else totals.outbound += quantity;
    byUnit.set(row.unit, totals);
  }
  const totals = [...byUnit].sort(([left], [right]) => left.localeCompare(right)).map(([unit, value]) => Object.freeze({ unit, inboundQuantity: format(value.inbound), outboundQuantity: format(value.outbound) }));
  return Object.freeze({
    items: Object.freeze(items),
    summary: Object.freeze({ movementCount: items.length, productCount: new Set(items.map((row) => row.productId)).size, projectCount: new Set(items.map((row) => row.projectId)).size, totals: Object.freeze(totals) }),
  });
}
