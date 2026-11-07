// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export interface SupplierInvoiceProjectionRow {
  readonly projectId: string;
  readonly supplierShipmentId: string;
  readonly state: string;
  readonly amount: string;
  readonly outstandingAmount: string;
}

function six(value: DecimalAmount): string {
  const rendered = value.toString();
  const [whole, fraction = ""] = rendered.split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

function activeOutstanding(rows: readonly SupplierInvoiceProjectionRow[]): string {
  return six(rows.filter((row) => row.state === "CONFIRMED").reduce(
    (total, row) => total.add(DecimalAmount.parse(row.outstandingAmount)),
    DecimalAmount.parse("0"),
  ));
}

export function supplierShipmentInvoiceProjection(rows: readonly SupplierInvoiceProjectionRow[], shipmentId: string) {
  const shipmentRows = rows.filter((row) => row.supplierShipmentId === shipmentId);
  return Object.freeze({
    supplierShipmentId: shipmentId,
    supplierInvoiceOutstanding: activeOutstanding(shipmentRows),
    hasConfirmedNonCancelledInvoice: shipmentRows.some((row) => row.state === "CONFIRMED"),
  });
}

export function projectSupplierInvoiceProjection(rows: readonly SupplierInvoiceProjectionRow[], projectId: string) {
  const projectRows = rows.filter((row) => row.projectId === projectId);
  const receivedShipmentIds = new Set(projectRows.map((row) => row.supplierShipmentId));
  return Object.freeze({
    projectId,
    supplierInvoiceOutstanding: activeOutstanding(projectRows),
    supplierInvoiceClosurePrerequisiteMet: receivedShipmentIds.size > 0
      && [...receivedShipmentIds].every((shipmentId) => projectRows.some((row) => row.supplierShipmentId === shipmentId && row.state === "CONFIRMED")),
  });
}
