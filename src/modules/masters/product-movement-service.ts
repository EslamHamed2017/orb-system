// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export type ProductMovementDirection = "INBOUND" | "OUTBOUND";
export type ProductMovementTransactionType = "SUPPLIER_CONTAINER" | "SALES_SHIPMENT";
export interface ProductMovementSourceAllocation { readonly supplierShipmentLineId: string; readonly quantity: string }
export interface ProductMovementRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly direction: ProductMovementDirection;
  readonly projectId: string;
  readonly productId: string;
  readonly quantity: string;
  readonly transactionType: ProductMovementTransactionType;
  readonly transactionId: string;
  readonly shipmentLineId: string;
  readonly contractLineVersionId: string;
  readonly counterpartyId: string;
  readonly sourceAllocations: readonly ProductMovementSourceAllocation[];
}
export interface ProductMovementRepository {
  productExists(productId: string): Promise<boolean>;
  listByProduct(productId: string): Promise<readonly ProductMovementRecord[]>;
}
export interface ProductMovementService {
  list(input: { productId: string; projectId?: string; correlationId: string }): Promise<Readonly<{ productId: string; projectId: string | null; items: readonly ProductMovementRecord[] }>>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }
function quantity(value: string, correlationId: string): string {
  const match = DECIMAL.exec(value);
  if (!match || BigInt(value.replace(".", "")) <= 0n) fail("VALIDATION_FAILED", 400, correlationId);
  return `${value.split(".")[0]}.${(match[1] ?? "").padEnd(6, "0")}`;
}
function normalize(row: ProductMovementRecord, productId: string, correlationId: string): ProductMovementRecord {
  for (const value of [row.id, row.projectId, row.productId, row.transactionId, row.shipmentLineId, row.contractLineVersionId, row.counterpartyId]) validId(value, correlationId);
  if (row.productId !== productId || !["INBOUND", "OUTBOUND"].includes(row.direction) || !["SUPPLIER_CONTAINER", "SALES_SHIPMENT"].includes(row.transactionType) || Number.isNaN(Date.parse(row.occurredAt))) fail("VALIDATION_FAILED", 400, correlationId);
  const sourceAllocations = row.sourceAllocations.map((allocation) => { validId(allocation.supplierShipmentLineId, correlationId); return Object.freeze({ supplierShipmentLineId: allocation.supplierShipmentLineId, quantity: quantity(allocation.quantity, correlationId) }); });
  return Object.freeze({ ...row, quantity: quantity(row.quantity, correlationId), sourceAllocations: Object.freeze(sourceAllocations) });
}
export function createProductMovementService(options: { repository: ProductMovementRepository }): ProductMovementService {
  return {
    async list(input) {
      validId(input.productId, input.correlationId);
      if (input.projectId !== undefined) validId(input.projectId, input.correlationId);
      if (!await options.repository.productExists(input.productId)) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      const items = (await options.repository.listByProduct(input.productId))
        .filter((row) => row.productId === input.productId && (input.projectId === undefined || row.projectId === input.projectId))
        .map((row) => normalize(row, input.productId, input.correlationId))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
      return Object.freeze({ productId: input.productId, projectId: input.projectId ?? null, items: Object.freeze(items) });
    },
  };
}
