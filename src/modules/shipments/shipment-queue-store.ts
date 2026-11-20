import type { SqlClient } from "./execution/shipment-execution-store.ts";

/** Every shipment of the company in one list, newest first, with what is waiting on it. No prices (Operations sees this too). */
export interface QueueShipment {
  readonly type: "SUPPLIER" | "SALES";
  readonly id: string;
  readonly reference: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly counterpartyName: string;
  readonly quantity: string;
  readonly state: string;
  readonly estimatedDeparture: string | null;
  readonly estimatedArrival: string | null;
  readonly waitingForApproval: boolean;
  readonly hasSource: boolean | null;
  readonly invoiceState: string | null;
}

export class PrismaShipmentQueueStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async list(tenantId: string): Promise<QueueShipment[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT 'SUPPLIER' type, s."id", s."reference", p."id" project_id, p."reference" project_reference, x."registered_name" counterparty, d."quantity"::text quantity,
              s."execution_state"::text state, d."estimated_departure", d."estimated_arrival", NULL::boolean has_source,
              EXISTS (SELECT 1 FROM "Approval" a WHERE a."subject_id" = s."id" AND a."decision" = 'PENDING') waiting,
              (SELECT i."state"::text FROM "SupplierInvoice" i WHERE i."supplier_shipment_id" = s."id" AND i."state"::text NOT IN ('CANCELLED', 'REJECTED') LIMIT 1) invoice_state
         FROM "SupplierShipment" s JOIN "Project" p ON p."id" = s."project_id" JOIN "SupplierShipmentDataset" d ON d."id" = s."active_dataset_id"
         LEFT JOIN "Supplier" x ON x."id" = d."supplier_master_id"
        WHERE s."tenant_id" = $1
       UNION ALL
       SELECT 'SALES', s."id", s."reference", p."id", p."reference", c."legal_name", d."quantity"::text, s."execution_state"::text, d."estimated_departure", d."estimated_arrival",
              s."primary_supplier_shipment_id" IS NOT NULL,
              EXISTS (SELECT 1 FROM "Approval" a WHERE a."subject_id" = s."id" AND a."decision" = 'PENDING'),
              (SELECT i."state"::text FROM "SalesInvoice" i WHERE i."sales_shipment_id" = s."id" AND i."state"::text <> 'CANCELLED' LIMIT 1)
         FROM "SalesShipment" s JOIN "Project" p ON p."id" = s."project_id" JOIN "SalesShipmentDataset" d ON d."id" = s."active_dataset_id"
         LEFT JOIN "Customer" c ON c."id" = d."customer_id"
        WHERE s."tenant_id" = $1
        ORDER BY 2 DESC`, tenantId);
    const day = (value: unknown) => (value ? new Date(value as string).toISOString().slice(0, 10) : null);
    return rows.map((r) => ({
      type: r.type as QueueShipment["type"], id: String(r.id), reference: String(r.reference), projectId: String(r.project_id), projectReference: String(r.project_reference),
      counterpartyName: String(r.counterparty ?? ""), quantity: Number(r.quantity).toFixed(3), state: String(r.state),
      estimatedDeparture: day(r.estimated_departure), estimatedArrival: day(r.estimated_arrival), waitingForApproval: Boolean(r.waiting),
      hasSource: r.has_source === null || r.has_source === undefined ? null : Boolean(r.has_source), invoiceState: r.invoice_state ? String(r.invoice_state) : null,
    }));
  }
}
