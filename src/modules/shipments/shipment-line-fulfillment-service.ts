import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface FulfillmentLineSnapshot { readonly id: string; readonly projectId: string; readonly coffeeSpecificationId: string; readonly quantity: string; readonly allocatedQuantity: string }
export interface ShipmentLineSourceAllocationRecord { readonly id: string; readonly salesShipmentDatasetLineId: string; readonly supplierShipmentDatasetLineId: string; readonly quantity: string }
export interface LockedFulfillmentLines {
  readonly salesLine: FulfillmentLineSnapshot | null;
  readonly supplierLine: FulfillmentLineSnapshot | null;
  insert(row: ShipmentLineSourceAllocationRecord): Promise<ShipmentLineSourceAllocationRecord>;
}
export interface ContractLineFulfillmentSnapshot { readonly contractLineVersionId: string; readonly approvedQuantity: string; readonly unitPrice: string; readonly fulfilledQuantity: string }
export interface ShipmentLineFulfillmentRepository {
  runSerializable<T>(input: { salesShipmentDatasetLineId: string; supplierShipmentDatasetLineId: string }, work: (locked: LockedFulfillmentLines) => Promise<T>): Promise<T>;
  getContractLineFulfillment(contractLineVersionId: string): Promise<ContractLineFulfillmentSnapshot | null>;
}
export interface ShipmentLineFulfillmentService {
  allocate(input: { salesShipmentDatasetLineId: string; supplierShipmentDatasetLineId: string; quantity: string; correlationId: string }): Promise<ShipmentLineSourceAllocationRecord>;
  remaining(input: { contractLineVersionId: string; correlationId: string }): Promise<Readonly<Record<string, string>>>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_20_6 = /^(?:0|[1-9][0-9]{0,13})(?:\.([0-9]{1,6}))?$/;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function parse(value: string, correlationId: string): { units: bigint; scale: number } {
  const match = DECIMAL_20_6.exec(value);
  if (!match) fail("VALIDATION_FAILED", 400, correlationId);
  const fraction = match[1] ?? "";
  return { units: BigInt(value.replace(".", "")), scale: fraction.length };
}
function scaled(value: string, scale: number, correlationId: string): bigint {
  const parsed = parse(value, correlationId);
  return parsed.units * 10n ** BigInt(scale - parsed.scale);
}
function render(units: bigint, scale: number): string {
  const negative = units < 0n; const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const result = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${result}` : result;
}
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }

export function createShipmentLineFulfillmentService(options: { repository: ShipmentLineFulfillmentRepository; newId?: () => string }): ShipmentLineFulfillmentService {
  const newId = options.newId ?? randomUUID;
  return {
    async allocate(input) {
      validId(input.salesShipmentDatasetLineId, input.correlationId); validId(input.supplierShipmentDatasetLineId, input.correlationId);
      const requested = scaled(input.quantity, 6, input.correlationId);
      if (requested <= 0n) fail("VALIDATION_FAILED", 400, input.correlationId);
      return options.repository.runSerializable({ salesShipmentDatasetLineId: input.salesShipmentDatasetLineId, supplierShipmentDatasetLineId: input.supplierShipmentDatasetLineId }, async (locked) => {
        if (!locked.salesLine || !locked.supplierLine) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
        if (locked.salesLine.id !== input.salesShipmentDatasetLineId || locked.supplierLine.id !== input.supplierShipmentDatasetLineId) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
        if (locked.salesLine.projectId !== locked.supplierLine.projectId || locked.salesLine.coffeeSpecificationId !== locked.supplierLine.coffeeSpecificationId) fail("ALLOCATION_SOURCE_MISMATCH", 409, input.correlationId);
        const salesRemaining = scaled(locked.salesLine.quantity, 6, input.correlationId) - scaled(locked.salesLine.allocatedQuantity, 6, input.correlationId);
        const supplierRemaining = scaled(locked.supplierLine.quantity, 6, input.correlationId) - scaled(locked.supplierLine.allocatedQuantity, 6, input.correlationId);
        if (requested > salesRemaining || requested > supplierRemaining) fail("FULFILLMENT_QUANTITY_EXCEEDED", 409, input.correlationId);
        return locked.insert(Object.freeze({ id: newId(), salesShipmentDatasetLineId: input.salesShipmentDatasetLineId, supplierShipmentDatasetLineId: input.supplierShipmentDatasetLineId, quantity: render(requested, 6) }));
      });
    },
    async remaining(input) {
      validId(input.contractLineVersionId, input.correlationId);
      const found = await options.repository.getContractLineFulfillment(input.contractLineVersionId);
      if (!found) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      const approved = scaled(found.approvedQuantity, 6, input.correlationId), fulfilled = scaled(found.fulfilledQuantity, 6, input.correlationId);
      const remaining = approved - fulfilled;
      if (remaining < 0n) fail("FULFILLMENT_QUANTITY_EXCEEDED", 409, input.correlationId);
      const price = scaled(found.unitPrice, 6, input.correlationId);
      return Object.freeze({ contractLineVersionId: found.contractLineVersionId, approvedQuantity: render(approved, 6), fulfilledQuantity: render(fulfilled, 6), remainingQuantity: render(remaining, 6), unitPrice: render(price, 6), remainingValue: render(remaining * price, 12) });
    },
  };
}
