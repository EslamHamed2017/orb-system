import type { SqlClient } from "../shipments/execution/shipment-execution-store.ts";

/**
 * Contract fulfillment and product movement from the database.
 *
 * Contract fulfillment: every approved contract (its active version) — contracted quantity and value, against the
 *   quantity on its confirmed shipments (confirmed, in transit, delivered / received) at the contract price.
 *   Over-delivery within tolerance shows as fulfilled above contracted; remaining never goes below zero.
 * Product movement: confirmed supplier shipments are inbound, confirmed customer shipments are outbound, dated by the
 *   owner's confirmation. It traces quantities; it is not a stock balance or inventory valuation.
 */

export interface ContractFulfillmentRow {
  readonly id: string; readonly approvedOn: string; readonly contractType: "SALES" | "PURCHASE"; readonly contractId: string; readonly contractReference: string; readonly lineNumber: number;
  readonly projectId: string; readonly projectReference: string; readonly productId: string; readonly productReference: string; readonly productName: string; readonly counterpartyName: string;
  readonly contractedQuantity: string; readonly fulfilledQuantity: string; readonly unit: string; readonly contractedValue: string; readonly fulfilledValue: string; readonly currency: string;
}

export interface ProductMovementRow {
  readonly id: string; readonly occurredOn: string; readonly occurredAt: string; readonly direction: "INBOUND" | "OUTBOUND"; readonly productId: string; readonly productReference: string; readonly productName: string;
  readonly projectId: string; readonly projectReference: string; readonly projectName: string; readonly quantity: string; readonly unit: string;
  readonly transactionType: "SUPPLIER_CONTAINER" | "SALES_SHIPMENT"; readonly transactionId: string; readonly transactionReference: string;
  readonly counterpartyName: string; readonly contractLineReference: string; readonly sourceAllocationCount: number;
}

const SHIPPED_SALES = `('CONFIRMED', 'IN_TRANSIT', 'DELIVERED')`;
const SHIPPED_SUPPLIER = `('CONFIRMED', 'IN_TRANSIT', 'RECEIVED')`;
/** Exact decimal text with up to 6 places, trailing zeros removed. */
function dec(value: unknown): string {
  const text = String(value ?? "0");
  if (!text.includes(".")) return text;
  const [whole, fraction] = text.split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
const day = (value: unknown) => (value ? new Date(value as string).toISOString().slice(0, 10) : "");

export class PrismaTradeReportsStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async contractFulfillment(tenantId: string, projectId: string | null): Promise<ContractFulfillmentRow[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT k."id"::text id, k."kind"::text kind, k."reference", k."project_id"::text project_id, p."reference" project_reference,
              COALESCE(ap."decided_at", v."effective_date"::timestamptz) approved_at, cs."id"::text product_id, cs."reference" product_reference, cs."name_en" product_name,
              CASE WHEN k."kind"::text = 'SALES' THEN cu."legal_name" ELSE su."registered_name" END party,
              v."quantity"::text quantity, ROUND(v."quantity" * v."unit_price", 6)::text contracted_value, v."unit_price"::text unit_price, btrim(v."currency") currency,
              CASE WHEN k."kind"::text = 'SALES'
                THEN COALESCE((SELECT SUM(d."quantity") FROM "SalesShipment" s JOIN "SalesShipmentDataset" d ON d."id" = s."active_dataset_id"
                                WHERE s."sales_contract_id" = k."id" AND s."execution_state"::text IN ${SHIPPED_SALES}), 0)
                ELSE COALESCE((SELECT SUM(d."quantity") FROM "SupplierShipment" s JOIN "SupplierShipmentDataset" d ON d."id" = s."active_dataset_id"
                                WHERE s."purchase_contract_id" = k."id" AND s."execution_state"::text IN ${SHIPPED_SUPPLIER}), 0) END::text fulfilled
         FROM "Contract" k JOIN "ContractVersion" v ON v."id" = k."active_version_id" JOIN "Project" p ON p."id" = k."project_id"
         JOIN "CoffeeSpecification" cs ON cs."id" = v."coffee_specification_id"
         LEFT JOIN "Customer" cu ON cu."id" = p."customer_master_id" LEFT JOIN "Supplier" su ON su."id" = k."counterparty_supplier_id"
         LEFT JOIN "Approval" ap ON ap."id" = v."approval_id" AND ap."decision" = 'APPROVED'
        WHERE k."tenant_id" = $1 AND v."state"::text = 'APPROVED' AND p."lifecycle_state"::text <> 'CANCELLED' AND ($2::uuid IS NULL OR k."project_id" = $2::uuid)
        ORDER BY p."reference", k."kind" DESC, k."reference"`, tenantId, projectId);
    return rows.map((r) => {
      const fulfilled = String(r.fulfilled);
      return {
        id: String(r.id), approvedOn: day(r.approved_at), contractType: r.kind === "SALES" ? "SALES" : "PURCHASE", contractId: String(r.id), contractReference: String(r.reference), lineNumber: 1,
        projectId: String(r.project_id), projectReference: String(r.project_reference), productId: String(r.product_id), productReference: String(r.product_reference), productName: String(r.product_name),
        counterpartyName: String(r.party ?? ""), contractedQuantity: dec(r.quantity), fulfilledQuantity: dec(fulfilled), unit: "MT",
        contractedValue: dec(r.contracted_value), fulfilledValue: dec((Math.round(Number(fulfilled) * Number(r.unit_price) * 1e6) / 1e6).toFixed(6)), currency: String(r.currency),
      };
    });
  }

  async productMovements(tenantId: string, filters: { productId: string | null; projectId: string | null }): Promise<ProductMovementRow[]> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT 'INBOUND' direction, s."id"::text id, s."reference", s."project_id"::text project_id, p."reference" project_reference, cu."legal_name" project_name,
              d."quantity"::text quantity, cs."id"::text product_id, cs."reference" product_reference, cs."name_en" product_name, su."registered_name" party, k."reference" contract_reference,
              COALESCE((SELECT MAX(a."decided_at") FROM "Approval" a WHERE a."subject_id" = s."id" AND a."action_code"::text = 'SUPPLIER_SHIPMENT_CONFIRMATION' AND a."decision" = 'APPROVED'), d."created_at") occurred_at,
              0 allocations
         FROM "SupplierShipment" s JOIN "SupplierShipmentDataset" d ON d."id" = s."active_dataset_id" JOIN "Project" p ON p."id" = s."project_id"
         JOIN "Customer" cu ON cu."id" = p."customer_master_id" JOIN "CoffeeSpecification" cs ON cs."id" = d."coffee_specification_id"
         JOIN "Contract" k ON k."id" = s."purchase_contract_id" LEFT JOIN "Supplier" su ON su."id" = k."counterparty_supplier_id"
        WHERE s."tenant_id" = $1 AND s."execution_state"::text IN ${SHIPPED_SUPPLIER}
          AND ($2::uuid IS NULL OR cs."id" = $2::uuid) AND ($3::uuid IS NULL OR s."project_id" = $3::uuid)
       UNION ALL
       SELECT 'OUTBOUND', s."id"::text, s."reference", s."project_id"::text, p."reference", cu."legal_name",
              d."quantity"::text, cs."id"::text, cs."reference", cs."name_en", cu."legal_name", k."reference",
              COALESCE((SELECT MAX(a."decided_at") FROM "Approval" a WHERE a."subject_id" = s."id" AND a."action_code"::text = 'SALES_SHIPMENT_CONFIRMATION' AND a."decision" = 'APPROVED'), d."created_at"),
              CASE WHEN s."primary_supplier_shipment_id" IS NULL THEN 0 ELSE 1 END
         FROM "SalesShipment" s JOIN "SalesShipmentDataset" d ON d."id" = s."active_dataset_id" JOIN "Project" p ON p."id" = s."project_id"
         JOIN "Customer" cu ON cu."id" = p."customer_master_id" JOIN "CoffeeSpecification" cs ON cs."id" = d."coffee_specification_id"
         JOIN "Contract" k ON k."id" = s."sales_contract_id"
        WHERE s."tenant_id" = $1 AND s."execution_state"::text IN ${SHIPPED_SALES}
          AND ($2::uuid IS NULL OR cs."id" = $2::uuid) AND ($3::uuid IS NULL OR s."project_id" = $3::uuid)
        ORDER BY occurred_at, id`, tenantId, filters.productId, filters.projectId);
    return rows.map((r) => ({
      id: `${r.direction === "INBOUND" ? "in" : "out"}-${r.id}`, occurredOn: day(r.occurred_at), occurredAt: new Date(r.occurred_at as string).toISOString(),
      direction: r.direction === "INBOUND" ? "INBOUND" : "OUTBOUND", productId: String(r.product_id), productReference: String(r.product_reference), productName: String(r.product_name),
      projectId: String(r.project_id), projectReference: String(r.project_reference), projectName: String(r.project_name), quantity: dec(r.quantity), unit: "MT",
      transactionType: r.direction === "INBOUND" ? "SUPPLIER_CONTAINER" : "SALES_SHIPMENT", transactionId: String(r.id), transactionReference: String(r.reference),
      counterpartyName: String(r.party ?? ""), contractLineReference: `${r.contract_reference}/L1`, sourceAllocationCount: Number(r.allocations),
    }));
  }

  async productExists(tenantId: string, productId: string) {
    return (await this.client.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "CoffeeSpecification" WHERE "id" = $1 AND "tenant_id" = $2`, productId, tenantId)).length > 0;
  }

  async product(tenantId: string, productId: string) {
    return (await this.client.$queryRawUnsafe<Array<{ id: string; reference: string; name_en: string; name_ar: string }>>(
      `SELECT "id"::text id, "reference", "name_en", "name_ar" FROM "CoffeeSpecification" WHERE "id" = $1 AND "tenant_id" = $2`, productId, tenantId))[0] ?? null;
  }
}
