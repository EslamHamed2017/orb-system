import "server-only";
export interface SalesInvoiceListItem {
  readonly id: string; readonly projectId: string; readonly shipmentId: string; readonly shipmentReference?: string; readonly projectReference?: string;
  readonly partyNameAr?: string; readonly occurredOn: string; readonly state: string; readonly reference: string; readonly currency: string;
  readonly amount: string; readonly outstandingAmount: string; readonly partyName?: string; readonly sourceReference?: string;
  readonly lines?: readonly { readonly id: string; readonly description: string; readonly sourceReference: string; readonly quantity: string; readonly unit: string; readonly unitPrice: string; readonly amount: string }[];
}
interface Row { id: string; project_id: string; project_reference: string; shipment_id: string; shipment_reference: string; invoice_date: string | Date; state: string; reference: string; currency: string; amount: string; outstanding_amount: string; party_name: string; party_name_ar: string }
export async function loadProjectSalesInvoices(projectId: string): Promise<readonly SalesInvoiceListItem[]> {
  const selected = projectId.trim();
  if (!selected) throw new TypeError("Project ID is required");
  if (!process.env.DATABASE_URL) throw new Error("Sales invoice database is unavailable");
  // @ts-expect-error pg is an accepted runtime dependency; optional declarations are intentionally absent.
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT i.id, i.project_id, p.reference AS project_reference,
             s.id AS shipment_id, s.reference AS shipment_reference,
             i.invoice_date, i.state::text, i.reference, i.currency,
             COALESCE(lines.amount, 0)::text AS amount,
             GREATEST(COALESCE(lines.amount, 0) - COALESCE(allocations.amount, 0), 0)::text AS outstanding_amount,
             party.legal_name_en AS party_name, party.legal_name_ar AS party_name_ar
      FROM "SalesInvoice" i
      JOIN "Project" p ON p.id = i.project_id
      JOIN "SalesShipment" s ON s.id = i.sales_shipment_id AND s.project_id = i.project_id
      JOIN "Party" party ON party.id = i.customer_id
      LEFT JOIN LATERAL (SELECT SUM(line_amount) AS amount FROM "SalesInvoiceLine" WHERE sales_invoice_id = i.id) lines ON true
      LEFT JOIN LATERAL (SELECT SUM(amount) AS amount FROM "SettlementAllocation" WHERE target_type::text = 'SALES_INVOICE' AND target_id = i.id AND state::text = 'ACTIVE') allocations ON true
      WHERE i.project_id::text = $1 AND i.state::text <> 'CANCELLED'
      ORDER BY i.invoice_date DESC, i.id ASC
    `, [selected]) as { rows: Row[] };
    return Object.freeze(result.rows.map((row: Row) => Object.freeze({ id: row.id, projectId: row.project_id, projectReference: row.project_reference, shipmentId: row.shipment_id, shipmentReference: row.shipment_reference, occurredOn: new Date(row.invoice_date).toISOString().slice(0, 10), state: row.state, reference: row.reference, currency: row.currency, amount: row.amount, outstandingAmount: row.outstanding_amount, partyName: row.party_name, partyNameAr: row.party_name_ar })));
  } finally { await client.end(); }
}
