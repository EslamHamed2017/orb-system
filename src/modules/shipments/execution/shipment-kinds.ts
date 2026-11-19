/** Everything that differs between a supplier (inbound) and a sales (outbound) shipment. */

export type ShipmentKind = "SUPPLIER" | "SALES";
export type ExecutionState = "DRAFT" | "CONFIRMED" | "IN_TRANSIT" | "RECEIVED" | "DELIVERED" | "CANCELLED" | "REJECTED";

export interface KindConfig {
  readonly kind: ShipmentKind;
  readonly shipmentTable: string;
  readonly datasetTable: string;
  readonly contractColumn: string;
  readonly contractVersionColumn: string;
  /** Free-text reference that operations may correct while the shipment is a draft. */
  readonly referenceColumn: string;
  readonly approvalAction: "SUPPLIER_SHIPMENT_CONFIRMATION" | "SALES_SHIPMENT_CONFIRMATION";
  readonly arrivedState: "RECEIVED" | "DELIVERED";
  readonly counterpartySql: string;
}

export const KINDS: Readonly<Record<ShipmentKind, KindConfig>> = Object.freeze({
  SUPPLIER: {
    kind: "SUPPLIER",
    shipmentTable: `"SupplierShipment"`,
    datasetTable: `"SupplierShipmentDataset"`,
    contractColumn: `"purchase_contract_id"`,
    contractVersionColumn: `"purchase_contract_version_id"`,
    referenceColumn: `"supplier_lot_reference"`,
    approvalAction: "SUPPLIER_SHIPMENT_CONFIRMATION",
    arrivedState: "RECEIVED",
    counterpartySql: `(SELECT json_build_object('id', x."id", 'reference', x."reference", 'name', x."registered_name", 'nameAr', x."display_name_ar") FROM "Supplier" x WHERE x."id" = d."supplier_master_id")`,
  },
  SALES: {
    kind: "SALES",
    shipmentTable: `"SalesShipment"`,
    datasetTable: `"SalesShipmentDataset"`,
    contractColumn: `"sales_contract_id"`,
    contractVersionColumn: `"sales_contract_version_id"`,
    referenceColumn: `"customer_purchase_order_reference"`,
    approvalAction: "SALES_SHIPMENT_CONFIRMATION",
    arrivedState: "DELIVERED",
    counterpartySql: `(SELECT json_build_object('id', x."id", 'reference', x."reference", 'name', x."legal_name", 'nameAr', x."legal_name_ar") FROM "Customer" x WHERE x."id" = d."customer_id")`,
  },
});

/** Allowed manual state changes after confirmation (confirmation itself goes through approval). */
export const TRANSITIONS: Readonly<Record<ShipmentKind, ReadonlySet<string>>> = Object.freeze({
  SUPPLIER: new Set(["DRAFT->CANCELLED", "CONFIRMED->IN_TRANSIT", "CONFIRMED->CANCELLED", "CONFIRMED->REJECTED", "IN_TRANSIT->RECEIVED", "IN_TRANSIT->REJECTED"]),
  SALES: new Set(["DRAFT->CANCELLED", "CONFIRMED->IN_TRANSIT", "CONFIRMED->CANCELLED", "CONFIRMED->REJECTED", "IN_TRANSIT->DELIVERED", "IN_TRANSIT->REJECTED"]),
});

export const REASON_REQUIRED: ReadonlySet<string> = new Set(["CANCELLED", "REJECTED"]);

export function isKind(value: string): value is ShipmentKind {
  return value === "SUPPLIER" || value === "SALES";
}

/** UUIDv7 ids carry their creation time in the first 48 bits. */
export function uuidV7Time(id: string): string | null {
  const hex = id.replaceAll("-", "").slice(0, 12);
  if (!/^[0-9a-f]{12}$/i.test(hex)) return null;
  return new Date(parseInt(hex, 16)).toISOString();
}
