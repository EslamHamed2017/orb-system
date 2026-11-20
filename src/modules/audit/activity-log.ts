/**
 * QuickBooks-style audit log ("Tools > Audit log"): one time-ordered list of who did what, read from every
 * module's append-only audit table for the signed-in company. Owner only. Read-only; nothing here can change history.
 */
interface SqlClient { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> }

export interface ActivityEntry {
  readonly id: string; readonly occurredAt: string; readonly userName: string; readonly area: string; readonly action: string;
  readonly subjectType: string; readonly subjectId: string | null; readonly projectId: string | null; readonly projectReference: string | null;
  readonly reference: string | null; readonly reason: string | null; readonly details: Record<string, unknown>;
}

const SOURCES = `
  SELECT e."id", e."occurred_at", e."actor_id", 'PROJECT' area, e."action", 'PROJECT' subject_type, e."project_id" subject_id, e."project_id", e."after" details FROM "ProjectAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'SHIPMENT', e."action", e."shipment_type", e."shipment_id", e."project_id", e."details" FROM "ShipmentAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'INVOICE', e."action", e."invoice_type", e."invoice_id", e."project_id", e."details" FROM "InvoiceAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'MONEY', e."action", e."subject_type", e."subject_id", e."project_id", e."details" FROM "MoneyAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'CLAIMS', e."action", e."subject_type", e."subject_id", e."project_id", e."details" FROM "ClaimClosureAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'CUSTOMER', e."action", 'CUSTOMER', e."customer_id", NULL::uuid, COALESCE(e."after", e."before") FROM "CustomerAuditEvent" e WHERE e."tenant_id" = $1
  UNION ALL SELECT e."id", e."occurred_at", e."actor_id", 'SUPPLIER', e."action", 'SUPPLIER', e."supplier_id", NULL::uuid, COALESCE(e."after", e."before") FROM "SupplierAuditEvent" e WHERE e."tenant_id" = $1`;

export async function listActivity(client: SqlClient, input: { tenantId: string; projectId?: string | null; from?: string | null; to?: string | null; limit?: number }): Promise<{ items: ActivityEntry[] }> {
  const limit = Math.min(Math.max(Number(input.limit ?? 200) || 200, 1), 500);
  const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT a."id"::text id, a."occurred_at", COALESCE(u."name_en", '') user_name, a.area, a."action", a.subject_type, a.subject_id::text subject_id,
            a."project_id"::text project_id, p."reference" project_reference, a.details::text details
       FROM (${SOURCES}) a
       LEFT JOIN "User" u ON u."id" = a."actor_id"
       LEFT JOIN "Project" p ON p."id" = a."project_id"
      WHERE ($2::uuid IS NULL OR a."project_id" = $2::uuid)
        AND ($3::date IS NULL OR a."occurred_at" >= $3::date) AND ($4::date IS NULL OR a."occurred_at" < $4::date + 1)
      ORDER BY a."occurred_at" DESC, a."id" DESC LIMIT ${limit}`,
    input.tenantId, input.projectId ?? null, input.from ?? null, input.to ?? null);
  return { items: rows.map((r) => {
    let details: Record<string, unknown> = {};
    try { details = JSON.parse(String(r.details ?? "{}")) ?? {}; } catch { details = {}; }
    const pick = (k: string) => (typeof details[k] === "string" ? details[k] as string : null);
    return {
      id: String(r.id), occurredAt: new Date(r.occurred_at as string).toISOString(), userName: String(r.user_name), area: String(r.area), action: String(r.action),
      subjectType: String(r.subject_type), subjectId: r.subject_id ? String(r.subject_id) : null, projectId: r.project_id ? String(r.project_id) : null,
      projectReference: r.project_reference ? String(r.project_reference) : null, reference: pick("reference"), reason: pick("reason") ?? pick("comment"), details,
    };
  }) };
}
