import "server-only";
export interface SalesInvoiceListItem {
  readonly id: string; readonly projectId: string; readonly shipmentId: string; readonly shipmentReference?: string; readonly projectReference?: string;
  readonly partyNameAr?: string; readonly occurredOn: string; readonly state: string; readonly reference: string; readonly currency: string;
  readonly amount: string; readonly outstandingAmount: string; readonly partyName?: string; readonly sourceReference?: string;
  readonly lines?: readonly { readonly id: string; readonly description: string; readonly sourceReference: string; readonly quantity: string; readonly unit: string; readonly unitPrice: string; readonly amount: string }[];
}
interface LineRow { id: string; description: string; source_reference: string; quantity: string; unit: string; unit_price: string; amount: string }
interface Row { id: string; project_id: string; project_reference: string; shipment_id: string; shipment_reference: string; invoice_date: string | Date; state: string; reference: string; currency: string; amount: string; outstanding_amount: string; party_name: string; party_name_ar: string; lines: LineRow[] | null }
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
             party.legal_name_en AS party_name, party.legal_name_ar AS party_name_ar,
             COALESCE(lines.items, '[]'::jsonb) AS lines
      FROM "SalesInvoice" i
      JOIN "Project" p ON p.id = i.project_id
      JOIN "SalesShipment" s ON s.id = i.sales_shipment_id AND s.project_id = i.project_id
      JOIN "Party" party ON party.id = i.customer_id
      LEFT JOIN LATERAL (
        SELECT SUM(line.line_amount) AS amount,
               JSONB_AGG(JSONB_BUILD_OBJECT(
                 'id', line.id::text,
                 'description', line.description,
                 'source_reference', s.reference || ' · ' || source_line.line_no::text,
                 'quantity', line.quantity::text,
                 'unit', '',
                 'unit_price', line.unit_price::text,
                 'amount', line.line_amount::text
               ) ORDER BY line.line_no) AS items
        FROM "SalesInvoiceLine" line
        JOIN "SalesShipmentDatasetLine" source_line
          ON source_line.id = line.sales_shipment_dataset_line_id
         AND source_line.sales_shipment_dataset_id = line.sales_shipment_dataset_id
        WHERE line.sales_invoice_id = i.id
      ) lines ON true
      LEFT JOIN LATERAL (SELECT SUM(amount) AS amount FROM "SettlementAllocation" WHERE target_type::text = 'CINV' AND target_id = i.id AND state::text = 'ACTIVE') allocations ON true
      WHERE i.project_id::text = $1 AND i.state::text <> 'CANCELLED'
      ORDER BY i.invoice_date DESC, i.id ASC
    `, [selected]) as { rows: Row[] };
    return Object.freeze(result.rows.map((row: Row) => Object.freeze({
      id: row.id, projectId: row.project_id, projectReference: row.project_reference, shipmentId: row.shipment_id,
      shipmentReference: row.shipment_reference, occurredOn: new Date(row.invoice_date).toISOString().slice(0, 10),
      state: row.state, reference: row.reference, currency: row.currency, amount: row.amount,
      outstandingAmount: row.outstanding_amount, partyName: row.party_name, partyNameAr: row.party_name_ar,
      lines: Object.freeze((row.lines ?? []).map((line) => Object.freeze({
        id: line.id, description: line.description, sourceReference: line.source_reference,
        quantity: line.quantity, unit: line.unit, unitPrice: line.unit_price, amount: line.amount,
      }))),
    })));
  } finally { await client.end(); }
}
