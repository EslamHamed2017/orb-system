/**
 * Live attachments index (QuickBooks-style): every file attached to a project's records, with what it is attached to.
 * Read-only; files are opened through /api/evidence/{id}/content, which re-checks access.
 */
export interface AttachmentItem {
  readonly id: string; readonly projectId: string; readonly projectReference: string;
  readonly subjectType: string; readonly subjectId: string; readonly subjectReference: string; readonly purpose: string;
  readonly originalFilename: string; readonly mediaType: string; readonly byteLength: number;
  readonly uploadedAt: string; readonly uploadedByName: string; readonly verificationState: string; readonly contentHref: string;
}

interface SqlClient { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> }

const REF = `CASE l."subject_type"::text
  WHEN 'SALES_INVOICE' THEN (SELECT "reference" FROM "SalesInvoice" WHERE "id" = l."subject_id")
  WHEN 'SUPPLIER_INVOICE' THEN (SELECT "reference" FROM "SupplierInvoice" WHERE "id" = l."subject_id")
  WHEN 'MONEY_MOVEMENT' THEN (SELECT "reference" FROM "MoneyMovement" WHERE "id" = l."subject_id")
  WHEN 'SALES_SHIPMENT' THEN (SELECT "reference" FROM "SalesShipment" WHERE "id" = l."subject_id")
  WHEN 'SUPPLIER_CONTAINER' THEN (SELECT "reference" FROM "SupplierShipment" WHERE "id" = l."subject_id")
  WHEN 'CONTRACT' THEN (SELECT "reference" FROM "Contract" WHERE "id" = l."subject_id")
  WHEN 'EXPENSE' THEN (SELECT COALESCE("description", "category_code") FROM "DirectExpense" WHERE "id" = l."subject_id")
  WHEN 'CLAIM' THEN (SELECT LEFT("description", 60) FROM "Claim" WHERE "id" = l."subject_id")
  ELSE p."reference" END`;

export async function listAttachments(client: SqlClient, input: { tenantId: string; projectId: string; subjectType?: string; subjectId?: string }): Promise<{ items: AttachmentItem[] }> {
  const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT o."id"::text id, o."project_id"::text project_id, p."reference" project_reference, l."subject_type"::text subject_type, l."subject_id"::text subject_id,
            COALESCE(${REF}, '') subject_reference, l."purpose", o."original_filename", o."media_type", o."byte_length"::bigint byte_length,
            o."uploaded_at", COALESCE(u."name_en", '') uploaded_by_name, o."verification_state"::text verification_state
       FROM "EvidenceObject" o
       JOIN "Project" p ON p."id" = o."project_id" AND p."tenant_id" = $1
       JOIN "EvidenceLink" l ON l."evidence_id" = o."id"
       LEFT JOIN "User" u ON u."id" = o."uploaded_by"
      WHERE o."project_id" = $2::uuid AND ($3::text IS NULL OR (l."subject_type"::text = $3 AND l."subject_id" = $4::uuid))
      ORDER BY o."uploaded_at" DESC, o."id"`,
    input.tenantId, input.projectId, input.subjectType ?? null, input.subjectId ?? null);
  return { items: rows.map((r) => ({
    id: String(r.id), projectId: String(r.project_id), projectReference: String(r.project_reference), subjectType: String(r.subject_type), subjectId: String(r.subject_id),
    subjectReference: String(r.subject_reference), purpose: String(r.purpose), originalFilename: String(r.original_filename), mediaType: String(r.media_type),
    byteLength: Number(r.byte_length), uploadedAt: new Date(r.uploaded_at as string).toISOString(), uploadedByName: String(r.uploaded_by_name),
    verificationState: String(r.verification_state), contentHref: `/api/evidence/${String(r.id)}/content`,
  })) };
}
