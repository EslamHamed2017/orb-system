import "server-only";

export interface PersistedSalesShipment {
  readonly id: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly reference: string;
  readonly executionState: string;
  readonly version: number;
  readonly attachments: readonly { readonly id: string; readonly originalFilename: string; readonly purpose: string; readonly mediaType: string; readonly uploadedAt: string; readonly verificationState: "PENDING" | "VERIFIED" | "REJECTED" }[];
  readonly dataset: null | {
    readonly revision: number;
    readonly version: number;
    readonly state: string;
    readonly productDescription: string;
    readonly quantity: string;
    readonly bagCount: number;
    readonly bagWeight: string;
    readonly netWeight: string;
    readonly grossWeight: string;
    readonly originLocation: string;
    readonly loadLocation: string;
    readonly dischargeLocation: string;
    readonly destinationLocation: string;
    readonly incoterm: string;
    readonly namedPlace: string;
    readonly containerNumbers: readonly string[];
    readonly sealNumbers: readonly string[];
    readonly carrier: string;
    readonly transportReference: string;
    readonly estimatedDeparture: string | null;
    readonly estimatedArrival: string | null;
  };
}

interface Row {
  id: string; project_id: string; project_reference: string; reference: string;
  execution_state: string; version: number; revision_no: number | null; dataset_version: number | null;
  dataset_state: string | null; product_description: string | null; quantity: string | null;
  bag_count: number | null; bag_weight: string | null; net_weight: string | null; gross_weight: string | null;
  origin_location: string | null; load_location: string | null; discharge_location: string | null;
  destination_location: string | null; incoterm: string | null; named_place: string | null;
  container_numbers: string[] | null; seal_numbers: string[] | null; carrier: string | null;
  transport_reference: string | null; estimated_departure: Date | string | null; estimated_arrival: Date | string | null;
  attachments: { id: string; original_filename: string; purpose: string; media_type: string; uploaded_at: Date | string; verification_state: "PENDING" | "VERIFIED" | "REJECTED" }[] | null;
}

function date(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

export async function loadPersistedSalesShipment(shipmentId: string, projectId: string): Promise<PersistedSalesShipment | null> {
  if (!process.env.DATABASE_URL) throw new Error("Sales shipment database is unavailable");
  // @ts-expect-error pg is an accepted runtime dependency; optional declarations are intentionally absent.
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT shipment.id, shipment.project_id, project.reference AS project_reference,
             shipment.reference, shipment.execution_state::text, shipment.version,
             dataset.revision_no, dataset.dataset_version, dataset.state::text AS dataset_state,
             dataset.product_description, dataset.quantity::text, dataset.bag_count,
             dataset.bag_weight::text, dataset.net_weight::text, dataset.gross_weight::text,
             dataset.origin_location, dataset.load_location, dataset.discharge_location,
             dataset.destination_location, dataset.incoterm, dataset.named_place,
             dataset.container_numbers, dataset.seal_numbers, dataset.carrier,
             dataset.transport_reference, dataset.estimated_departure, dataset.estimated_arrival,
             COALESCE(attachment_records.items, '[]'::jsonb) AS attachments
      FROM "SalesShipment" shipment
      JOIN "Project" project ON project.id = shipment.project_id
      LEFT JOIN "SalesShipmentDataset" dataset
        ON dataset.id = shipment.active_dataset_id AND dataset.shipment_id = shipment.id
      LEFT JOIN LATERAL (
        SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
          'id', evidence.id::text, 'original_filename', evidence.original_filename,
          'purpose', link.purpose, 'media_type', evidence.media_type,
          'uploaded_at', evidence.uploaded_at, 'verification_state', evidence.verification_state::text
        ) ORDER BY evidence.uploaded_at DESC, evidence.id) AS items
        FROM "EvidenceLink" link
        JOIN "EvidenceObject" evidence ON evidence.id = link.evidence_id AND evidence.project_id = link.project_id
        WHERE link.project_id = shipment.project_id
          AND link.subject_type::text = 'SALES_SHIPMENT'
          AND link.subject_id = shipment.id
      ) attachment_records ON true
      WHERE shipment.id::text = $1 AND shipment.project_id::text = $2
      LIMIT 1
    `, [shipmentId, projectId]) as { rows: Row[] };
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      id: row.id, projectId: row.project_id, projectReference: row.project_reference,
      reference: row.reference, executionState: row.execution_state, version: row.version,
      attachments: Object.freeze((row.attachments ?? []).map((attachment) => Object.freeze({
        id: attachment.id, originalFilename: attachment.original_filename, purpose: attachment.purpose,
        mediaType: attachment.media_type, uploadedAt: new Date(attachment.uploaded_at).toISOString(),
        verificationState: attachment.verification_state,
      }))),
      dataset: row.revision_no === null ? null : Object.freeze({
        revision: row.revision_no, version: row.dataset_version ?? row.revision_no,
        state: row.dataset_state ?? "UNKNOWN", productDescription: row.product_description ?? "—",
        quantity: row.quantity ?? "0", bagCount: row.bag_count ?? 0, bagWeight: row.bag_weight ?? "0",
        netWeight: row.net_weight ?? "0", grossWeight: row.gross_weight ?? "0",
        originLocation: row.origin_location ?? "—", loadLocation: row.load_location ?? "—",
        dischargeLocation: row.discharge_location ?? "—", destinationLocation: row.destination_location ?? "—",
        incoterm: row.incoterm ?? "—", namedPlace: row.named_place ?? "—",
        containerNumbers: Object.freeze(row.container_numbers ?? []), sealNumbers: Object.freeze(row.seal_numbers ?? []),
        carrier: row.carrier ?? "—", transportReference: row.transport_reference ?? "—",
        estimatedDeparture: date(row.estimated_departure), estimatedArrival: date(row.estimated_arrival),
      }),
    });
  } finally { await client.end(); }
}
