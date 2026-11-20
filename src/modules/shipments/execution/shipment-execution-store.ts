import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { KINDS, TRANSITIONS, uuidV7Time, type ExecutionState, type ShipmentKind } from "./shipment-kinds.ts";

/**
 * PostgreSQL persistence for shipment execution. Every read and write is tenant-scoped and every
 * command runs in one transaction that locks the shipment row, so concurrent commands serialize.
 */

export interface SqlTransaction {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}
export interface SqlClient extends SqlTransaction {
  $transaction<T>(fn: (tx: SqlTransaction) => Promise<T>): Promise<T>;
}

export class ShipmentStoreError extends Error {
  readonly code: "NOT_FOUND" | "STALE_VERSION" | "CONFLICT" | "INVALID";
  constructor(code: ShipmentStoreError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface DatasetRecord {
  readonly id: string;
  readonly revisionNo: number;
  readonly state: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SUPERSEDED";
  readonly hash: string;
  readonly quantity: string;
  readonly bagCount: number;
  readonly bagWeight: string;
  readonly netWeight: string;
  readonly grossWeight: string;
  readonly lotOrOrderReference: string | null;
  readonly containerNumbers: readonly string[];
  readonly sealNumbers: readonly string[];
  readonly incoterm: string;
  readonly namedPlace: string;
  readonly origin: string;
  readonly loadLocation: string;
  readonly dischargeLocation: string | null;
  readonly destination: string;
  readonly transport: {
    readonly mode: string; readonly carrier: string; readonly reference: string;
    readonly vesselOrVehicle: string | null; readonly voyageOrTrip: string | null;
    readonly estimatedDeparture: string | null; readonly estimatedArrival: string | null;
  };
  readonly plannedShipmentAt: string | null;
  readonly notes: string | null;
  readonly revisionReason: string;
  readonly createdAt: string;
  readonly createdBy: { readonly userId: string; readonly name: string };
}

export interface ShipmentDetail {
  readonly kind: ShipmentKind;
  readonly id: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly reference: string;
  readonly version: number;
  readonly executionState: ExecutionState;
  readonly contract: { readonly id: string; readonly reference: string; readonly versionId: string; readonly quantity: string; readonly toleranceOverPercent: string; readonly toleranceUnderPercent: string };
  readonly product: { readonly id: string; readonly name: string; readonly nameAr: string | null };
  readonly counterparty: { readonly id: string; readonly reference: string; readonly name: string; readonly nameAr: string | null } | null;
  readonly quantities: { readonly contracted: string; readonly thisShipment: string; readonly otherOpenShipments: string; readonly remaining: string };
  readonly primarySource: { readonly id: string; readonly reference: string; readonly executionState: ExecutionState } | null;
  readonly dataset: DatasetRecord;
  readonly revisions: readonly { readonly id: string; readonly revisionNo: number; readonly state: string; readonly quantity: string; readonly revisionReason: string; readonly createdAt: string; readonly createdByName: string }[];
  readonly pendingApproval: { readonly id: string; readonly requesterId: string; readonly requesterName: string; readonly requestedAt: string | null } | null;
  readonly lastDecision: { readonly approvalId: string; readonly decision: "APPROVED" | "REJECTED"; readonly approverName: string | null; readonly decidedAt: string | null; readonly comment: string | null } | null;
  readonly events: readonly { readonly fromState: string; readonly toState: string; readonly reason: string | null; readonly occurredAt: string; readonly actorName: string }[];
  readonly history: readonly { readonly action: string; readonly occurredAt: string; readonly actorName: string; readonly details: Record<string, unknown> }[];
}

export interface ApprovalInboxItem {
  readonly id: string;
  readonly actionCode: string;
  readonly subjectType: ShipmentKind;
  readonly subjectId: string;
  readonly subjectReference: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly quantity: string;
  readonly requesterId: string;
  readonly requesterName: string;
  readonly requestedAt: string | null;
}

export interface DatasetChanges {
  readonly quantity?: string;
  readonly bagCount?: number;
  readonly bagWeight?: string;
  readonly netWeight?: string;
  readonly grossWeight?: string;
  readonly lotOrOrderReference?: string | null;
  readonly containerNumbers?: readonly string[];
  readonly sealNumbers?: readonly string[];
  readonly transportCarrier?: string;
  readonly transportReference?: string;
  readonly vesselOrVehicle?: string | null;
  readonly voyageOrTrip?: string | null;
  readonly estimatedDeparture?: string | null;
  readonly estimatedArrival?: string | null;
  readonly plannedShipmentAt?: string | null;
  readonly notes?: string | null;
}

const iso = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string).toISOString());
const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
const six = (value: unknown) => {
  const [whole, fraction = ""] = String(value ?? "0").split(".");
  return `${whole}.${fraction.padEnd(6, "0").slice(0, 6)}`;
};

interface LockedShipment {
  id: string; project_id: string; reference: string; version: number; execution_state: ExecutionState;
  active_dataset_id: string; dataset_state: DatasetRecord["state"]; dataset_approval_id: string | null; dataset_hash: string;
  quantity: string; primary_supplier_shipment_id: string | null; contract_id: string; contract_version_id: string;
}

export class PrismaShipmentExecutionStore {
  private readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  // ---------------- reads ----------------

  async detail(tenantId: string, kind: ShipmentKind, shipmentId: string): Promise<ShipmentDetail> {
    return this.readDetail(this.client, tenantId, kind, shipmentId);
  }

  private async readDetail(tx: SqlTransaction, tenantId: string, kind: ShipmentKind, shipmentId: string): Promise<ShipmentDetail> {
    const k = KINDS[kind];
    const primary = kind === "SALES" ? `sh."primary_supplier_shipment_id"` : `NULL::uuid`;
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT sh."id", sh."project_id", p."reference" project_reference, sh."reference", sh."version", sh."execution_state"::text execution_state,
              ${primary} primary_id, row_to_json(d) dataset, ${k.counterpartySql} counterparty,
              c."id" contract_id, c."reference" contract_reference, cv."id" contract_version_id, cv."quantity"::text contract_quantity,
              cv."quantity_tolerance_over"::text tol_over, cv."quantity_tolerance_under"::text tol_under,
              spec."id" product_id, spec."name_en" product_name, spec."name_ar" product_name_ar,
              u."name_en" created_by_name,
              (SELECT COALESCE(SUM(od."quantity"), 0)::text FROM ${k.shipmentTable} os
                 JOIN ${k.datasetTable} od ON od."id" = os."active_dataset_id"
                WHERE os."tenant_id" = sh."tenant_id" AND os.${k.contractColumn} = sh.${k.contractColumn} AND os."id" <> sh."id"
                  AND os."execution_state" NOT IN ('CANCELLED','REJECTED')) other_quantity
         FROM ${k.shipmentTable} sh
         JOIN ${k.datasetTable} d ON d."id" = sh."active_dataset_id" AND d."shipment_id" = sh."id"
         JOIN "Project" p ON p."id" = sh."project_id" AND p."tenant_id" = sh."tenant_id"
         JOIN "Contract" c ON c."id" = sh.${k.contractColumn}
         JOIN "ContractVersion" cv ON cv."id" = d.${k.contractVersionColumn}
         JOIN "CoffeeSpecification" spec ON spec."id" = d."coffee_specification_id"
         JOIN "User" u ON u."id" = d."created_by"
        WHERE sh."tenant_id" = $1 AND sh."id" = $2`,
      tenantId, shipmentId,
    );
    const row = rows[0];
    if (!row) throw new ShipmentStoreError("NOT_FOUND", "Shipment not found");
    const d = row.dataset as Record<string, unknown>;

    const [revisions, events, history, approvals, primaryRows] = await Promise.all([
      tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT d."id", d."revision_no", d."state"::text state, d."quantity"::text quantity, d."revision_reason", d."created_at", u."name_en" created_by_name
           FROM ${k.datasetTable} d JOIN "User" u ON u."id" = d."created_by"
          WHERE d."shipment_id" = $1 AND d."tenant_id" = $2 ORDER BY d."revision_no" DESC`, shipmentId, tenantId),
      tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT e."from_state", e."to_state", e."reason", e."occurred_at", u."name_en" actor_name
           FROM "ShipmentExecutionEvent" e JOIN "User" u ON u."id" = e."actor_id"
          WHERE e."shipment_type" = $1 AND e."shipment_id" = $2 ORDER BY e."occurred_at" DESC, e."id" DESC`, kind, shipmentId),
      tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT a."action", a."occurred_at", a."details", u."name_en" actor_name
           FROM "ShipmentAuditEvent" a JOIN "User" u ON u."id" = a."actor_id"
          WHERE a."tenant_id" = $1 AND a."shipment_type" = $2 AND a."shipment_id" = $3 ORDER BY a."occurred_at" DESC, a."id" DESC LIMIT 100`, tenantId, kind, shipmentId),
      tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ap."id", ap."decision"::text decision, ap."requester_id", ru."name_en" requester_name, au."name_en" approver_name, ap."decided_at", ap."comment"
           FROM "Approval" ap JOIN "User" ru ON ru."id" = ap."requester_id" LEFT JOIN "User" au ON au."id" = ap."approver_id"
          WHERE ap."subject_type" = $1 AND ap."subject_id" = $2 AND ap."action_code"::text = $3 ORDER BY ap."id" DESC`, kind, shipmentId, k.approvalAction),
      row.primary_id
        ? tx.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT "id", "reference", "execution_state"::text execution_state FROM "SupplierShipment" WHERE "id" = $1 AND "tenant_id" = $2`, row.primary_id, tenantId)
        : Promise.resolve([]),
    ]);

    const pending = approvals.find((approval) => approval.decision === "PENDING");
    const decided = approvals.find((approval) => approval.decision === "APPROVED" || approval.decision === "REJECTED");
    const thisQuantity = six(d.quantity), other = six(row.other_quantity), contracted = six(row.contract_quantity);
    const remaining = Math.max(0, Number(contracted) - Number(other) - Number(thisQuantity));
    const source = primaryRows[0];

    return {
      kind,
      id: String(row.id),
      projectId: String(row.project_id),
      projectReference: String(row.project_reference),
      reference: String(row.reference),
      version: Number(row.version),
      executionState: row.execution_state as ExecutionState,
      contract: { id: String(row.contract_id), reference: String(row.contract_reference), versionId: String(row.contract_version_id), quantity: contracted, toleranceOverPercent: six(row.tol_over), toleranceUnderPercent: six(row.tol_under) },
      product: { id: String(row.product_id), name: String(row.product_name), nameAr: str(row.product_name_ar) },
      counterparty: (row.counterparty as ShipmentDetail["counterparty"]) ?? null,
      quantities: { contracted, thisShipment: thisQuantity, otherOpenShipments: other, remaining: remaining.toFixed(6) },
      primarySource: source ? { id: String(source.id), reference: String(source.reference), executionState: source.execution_state as ExecutionState } : null,
      dataset: {
        id: String(d.id), revisionNo: Number(d.revision_no), state: d.state as DatasetRecord["state"], hash: String(d.dataset_hash),
        quantity: thisQuantity, bagCount: Number(d.bag_count), bagWeight: six(d.bag_weight), netWeight: six(d.net_weight), grossWeight: six(d.gross_weight),
        lotOrOrderReference: str(kind === "SUPPLIER" ? d.supplier_lot_reference : d.customer_purchase_order_reference),
        containerNumbers: (d.container_numbers as string[]) ?? [], sealNumbers: (d.seal_numbers as string[]) ?? [],
        incoterm: String(d.incoterm), namedPlace: String(d.named_place),
        origin: [d.origin_location, d.origin_country].filter(Boolean).join(", "),
        loadLocation: [d.load_location, d.load_country].filter(Boolean).join(", "),
        dischargeLocation: d.discharge_location ? [d.discharge_location, d.discharge_country].filter(Boolean).join(", ") : null,
        destination: [d.destination_location, d.destination_country].filter(Boolean).join(", "),
        transport: {
          mode: String(d.transport_mode), carrier: String(d.carrier), reference: String(d.transport_reference),
          vesselOrVehicle: str(d.vessel_or_vehicle), voyageOrTrip: str(d.voyage_or_trip),
          estimatedDeparture: iso(d.estimated_departure), estimatedArrival: iso(d.estimated_arrival),
        },
        plannedShipmentAt: iso(d.planned_shipment_at),
        notes: str(d.notes),
        revisionReason: String(d.revision_reason),
        createdAt: iso(d.created_at) ?? "",
        createdBy: { userId: String(d.created_by), name: String(row.created_by_name) },
      },
      revisions: revisions.map((r) => ({ id: String(r.id), revisionNo: Number(r.revision_no), state: String(r.state), quantity: six(r.quantity), revisionReason: String(r.revision_reason), createdAt: iso(r.created_at) ?? "", createdByName: String(r.created_by_name) })),
      pendingApproval: pending ? { id: String(pending.id), requesterId: String(pending.requester_id), requesterName: String(pending.requester_name), requestedAt: uuidV7Time(String(pending.id)) } : null,
      lastDecision: decided ? { approvalId: String(decided.id), decision: decided.decision as "APPROVED" | "REJECTED", approverName: str(decided.approver_name), decidedAt: iso(decided.decided_at), comment: str(decided.comment) } : null,
      events: events.map((e) => ({ fromState: String(e.from_state), toState: String(e.to_state), reason: str(e.reason), occurredAt: iso(e.occurred_at) ?? "", actorName: String(e.actor_name) })),
      history: history.map((h) => ({ action: String(h.action), occurredAt: iso(h.occurred_at) ?? "", actorName: String(h.actor_name), details: (h.details as Record<string, unknown>) ?? {} })),
    };
  }

  async listPendingApprovals(tenantId: string): Promise<ApprovalInboxItem[]> {
    const items: ApprovalInboxItem[] = [];
    for (const kind of ["SUPPLIER", "SALES"] as const) {
      const k = KINDS[kind];
      const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ap."id", ap."action_code"::text action_code, ap."subject_id", ap."requester_id", u."name_en" requester_name,
                sh."reference", sh."project_id", p."reference" project_reference, d."quantity"::text quantity
           FROM "Approval" ap
           JOIN ${k.shipmentTable} sh ON sh."id" = ap."subject_id" AND sh."tenant_id" = $1
           JOIN ${k.datasetTable} d ON d."id" = sh."active_dataset_id"
           JOIN "Project" p ON p."id" = sh."project_id"
           JOIN "User" u ON u."id" = ap."requester_id"
          WHERE ap."subject_type" = $2 AND ap."action_code"::text = $3 AND ap."decision" = 'PENDING'
          ORDER BY ap."id"`, tenantId, kind, k.approvalAction);
      for (const r of rows) {
        items.push({
          id: String(r.id), actionCode: String(r.action_code), subjectType: kind, subjectId: String(r.subject_id), subjectReference: String(r.reference),
          projectId: String(r.project_id), projectReference: String(r.project_reference), quantity: six(r.quantity),
          requesterId: String(r.requester_id), requesterName: String(r.requester_name), requestedAt: uuidV7Time(String(r.id)),
        });
      }
    }
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Which shipment does an approval belong to (tenant-checked)? */
  async approvalSubject(tenantId: string, approvalId: string): Promise<{ kind: ShipmentKind; shipmentId: string; requesterId: string; decision: string } | null> {
    const rows = await this.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ap."subject_type", ap."subject_id", ap."requester_id", ap."decision"::text decision FROM "Approval" ap
        WHERE ap."id" = $1 AND ap."action_code"::text IN ('SUPPLIER_SHIPMENT_CONFIRMATION','SALES_SHIPMENT_CONFIRMATION')
          AND (EXISTS (SELECT 1 FROM "SupplierShipment" s WHERE s."id" = ap."subject_id" AND s."tenant_id" = $2)
            OR EXISTS (SELECT 1 FROM "SalesShipment" s WHERE s."id" = ap."subject_id" AND s."tenant_id" = $2))`, approvalId, tenantId);
    const row = rows[0];
    if (!row || (row.subject_type !== "SUPPLIER" && row.subject_type !== "SALES")) return null;
    return { kind: row.subject_type, shipmentId: String(row.subject_id), requesterId: String(row.requester_id), decision: String(row.decision) };
  }

  // ---------------- commands ----------------

  private async lock(tx: SqlTransaction, tenantId: string, kind: ShipmentKind, shipmentId: string, expectedVersion?: number): Promise<LockedShipment> {
    const k = KINDS[kind];
    const primary = kind === "SALES" ? `sh."primary_supplier_shipment_id"` : `NULL::uuid`;
    const rows = await tx.$queryRawUnsafe<LockedShipment[]>(
      `SELECT sh."id", sh."project_id", sh."reference", sh."version", sh."execution_state"::text execution_state, sh."active_dataset_id",
              d."state"::text dataset_state, d."approval_id" dataset_approval_id, d."dataset_hash", d."quantity"::text quantity,
              ${primary} primary_supplier_shipment_id, sh.${k.contractColumn} contract_id, d.${k.contractVersionColumn} contract_version_id
         FROM ${k.shipmentTable} sh JOIN ${k.datasetTable} d ON d."id" = sh."active_dataset_id"
        WHERE sh."tenant_id" = $1 AND sh."id" = $2 FOR UPDATE OF sh, d`, tenantId, shipmentId);
    const row = rows[0];
    if (!row) throw new ShipmentStoreError("NOT_FOUND", "Shipment not found");
    if (expectedVersion !== undefined && Number(row.version) !== expectedVersion) throw new ShipmentStoreError("STALE_VERSION", "The shipment changed since you loaded it. Reload and try again.");
    return row;
  }

  private async bumpVersion(tx: SqlTransaction, kind: ShipmentKind, shipment: LockedShipment, set = "") {
    await tx.$executeRawUnsafe(`UPDATE ${KINDS[kind].shipmentTable} SET "version" = "version" + 1${set ? `, ${set}` : ""} WHERE "id" = $1`, shipment.id);
  }

  private async audit(tx: SqlTransaction, input: { tenantId: string; kind: ShipmentKind; shipment: LockedShipment; actorId: string; action: string; details: Record<string, unknown> }) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "ShipmentAuditEvent" ("tenant_id","project_id","shipment_type","shipment_id","actor_id","action","details") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      input.tenantId, input.shipment.project_id, input.kind, input.shipment.id, input.actorId, input.action, JSON.stringify(input.details));
  }

  private async executionEvent(tx: SqlTransaction, input: { kind: ShipmentKind; shipment: LockedShipment; from: string; to: string; actorId: string; reason: string | null; idempotencyKey: string }) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "ShipmentExecutionEvent" ("shipment_type","shipment_id","from_state","to_state","dataset_id","occurred_at","reason","actor_id","aggregate_version","idempotency_key")
       VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9)`,
      input.kind, input.shipment.id, input.from, input.to, input.shipment.active_dataset_id, input.reason, input.actorId, Number(input.shipment.version) + 1, input.idempotencyKey);
  }

  /** Has this exact command already been applied? Lets the client retry safely after a network error. */
  async replayed(kind: ShipmentKind, shipmentId: string, idempotencyKey: string): Promise<boolean> {
    const rows = await this.client.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "ShipmentExecutionEvent" WHERE "shipment_type" = $1 AND "shipment_id" = $2 AND "idempotency_key" = $3`, kind, shipmentId, idempotencyKey);
    return rows.length > 0;
  }

  /** Creates a new immutable dataset revision with the changed operational fields; the old one is superseded. */
  async revise(input: { tenantId: string; kind: ShipmentKind; shipmentId: string; expectedVersion: number; actorId: string; reason: string; changes: DatasetChanges }): Promise<ShipmentDetail> {
    const k = KINDS[input.kind];
    return this.client.$transaction(async (tx) => {
      const shipment = await this.lock(tx, input.tenantId, input.kind, input.shipmentId, input.expectedVersion);
      if (shipment.execution_state !== "DRAFT") throw new ShipmentStoreError("CONFLICT", "Only a draft shipment can be edited.");
      if (shipment.dataset_state === "PENDING_APPROVAL") throw new ShipmentStoreError("CONFLICT", "This shipment is waiting for approval. Ask the approver to reject it before editing.");
      const c = input.changes;

      if (c.quantity !== undefined) {
        const cap = (await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(
          `SELECT COALESCE(SUM(d."quantity"), 0) + $3::numeric <= cv."quantity" * (1 + cv."quantity_tolerance_over" / 100) allowed
             FROM "ContractVersion" cv
             LEFT JOIN ${k.shipmentTable} sh ON sh.${k.contractColumn} = $4 AND sh."id" <> $1 AND sh."tenant_id" = $5 AND sh."execution_state" NOT IN ('CANCELLED','REJECTED')
             LEFT JOIN ${k.datasetTable} d ON d."id" = sh."active_dataset_id"
            WHERE cv."id" = $2 GROUP BY cv."quantity", cv."quantity_tolerance_over"`,
          shipment.id, shipment.contract_version_id, c.quantity, shipment.contract_id, input.tenantId))[0];
        if (!cap?.allowed) throw new ShipmentStoreError("INVALID", "The quantity exceeds what the contract allows (including the over-tolerance) across all open shipments.");
      }

      const nextId = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT orb_uuidv7()::text id`))[0].id;
      const set: Array<[string, unknown, string?]> = [];
      const add = (column: string, value: unknown, cast?: string) => { if (value !== undefined) set.push([column, value, cast]); };
      add(`"quantity"`, c.quantity, "numeric");
      add(`"bag_count"`, c.bagCount);
      add(`"bag_weight"`, c.bagWeight, "numeric");
      add(`"net_weight"`, c.netWeight, "numeric");
      add(`"gross_weight"`, c.grossWeight, "numeric");
      add(k.referenceColumn, c.lotOrOrderReference);
      add(`"container_numbers"`, c.containerNumbers ? [...c.containerNumbers] : undefined, "text[]");
      add(`"seal_numbers"`, c.sealNumbers ? [...c.sealNumbers] : undefined, "text[]");
      add(`"carrier"`, c.transportCarrier);
      add(`"transport_reference"`, c.transportReference);
      add(`"vessel_or_vehicle"`, c.vesselOrVehicle);
      add(`"voyage_or_trip"`, c.voyageOrTrip);
      add(`"estimated_departure"`, c.estimatedDeparture, "timestamptz");
      add(`"estimated_arrival"`, c.estimatedArrival, "timestamptz");
      add(`"planned_shipment_at"`, c.plannedShipmentAt, "timestamptz");
      add(`"notes"`, c.notes);

      const columns = (await tx.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, k.datasetTable.replaceAll('"', ""))).map((r) => `"${r.column_name}"`);
      const overridden = new Map(set.map(([column], index) => [column, index]));
      const fixed: Record<string, string> = {
        [`"id"`]: `$1::uuid`, [`"revision_no"`]: `d."revision_no" + 1`, [`"dataset_version"`]: `1`, [`"dataset_hash"`]: `$2`,
        [`"state"`]: `'DRAFT'`, [`"approval_id"`]: `NULL`, [`"created_by"`]: `$3::uuid`, [`"created_at"`]: `NOW()`, [`"revision_reason"`]: `$4`,
        [`"invalidated_approval_ids"`]: `d."invalidated_approval_ids"`,
      };
      const params: unknown[] = [nextId, "", input.actorId, input.reason, shipment.active_dataset_id];
      const select = columns.map((column) => {
        if (fixed[column]) return fixed[column];
        const index = overridden.get(column);
        if (index === undefined) return `d.${column}`;
        const [, value, cast] = set[index];
        params.push(value);
        return `$${params.length}${cast ? `::${cast}` : ""}`;
      });
      params[1] = createHash("sha256").update(JSON.stringify({ previous: shipment.dataset_hash, nextId, changes: c, reason: input.reason })).digest("hex");
      await tx.$executeRawUnsafe(`INSERT INTO ${k.datasetTable} (${columns.join(", ")}) SELECT ${select.join(", ")} FROM ${k.datasetTable} d WHERE d."id" = $5::uuid`, ...params);
      await tx.$executeRawUnsafe(`UPDATE ${k.datasetTable} SET "state" = 'SUPERSEDED' WHERE "id" = $1`, shipment.active_dataset_id);
      await this.bumpVersion(tx, input.kind, shipment, `"active_dataset_id" = '${nextId}'::uuid`);
      await this.audit(tx, { tenantId: input.tenantId, kind: input.kind, shipment, actorId: input.actorId, action: "DATASET_REVISED", details: { reason: input.reason, changes: c, previousDatasetId: shipment.active_dataset_id, datasetId: nextId } });
      return this.readDetail(tx, input.tenantId, input.kind, shipment.id);
    });
  }

  async setPrimarySource(input: { tenantId: string; shipmentId: string; supplierShipmentId: string; expectedVersion: number; actorId: string }): Promise<ShipmentDetail> {
    return this.client.$transaction(async (tx) => {
      const shipment = await this.lock(tx, input.tenantId, "SALES", input.shipmentId, input.expectedVersion);
      if (shipment.execution_state !== "DRAFT" || shipment.dataset_state === "PENDING_APPROVAL") throw new ShipmentStoreError("CONFLICT", "The source can only be changed on a draft that is not waiting for approval.");
      const source = (await tx.$queryRawUnsafe<Array<{ reference: string; execution_state: string; spec_ok: boolean }>>(
        `SELECT ss."reference", ss."execution_state"::text execution_state, sd."coffee_specification_id" = od."coffee_specification_id" spec_ok
           FROM "SupplierShipment" ss JOIN "SupplierShipmentDataset" sd ON sd."id" = ss."active_dataset_id",
                "SalesShipmentDataset" od
          WHERE ss."id" = $1 AND ss."tenant_id" = $2 AND ss."project_id" = $3 AND od."id" = $4`,
        input.supplierShipmentId, input.tenantId, shipment.project_id, shipment.active_dataset_id))[0];
      if (!source) throw new ShipmentStoreError("INVALID", "The supplier shipment must belong to the same project.");
      if (["CANCELLED", "REJECTED"].includes(source.execution_state)) throw new ShipmentStoreError("INVALID", "A cancelled or rejected supplier shipment cannot be the source.");
      if (!source.spec_ok) throw new ShipmentStoreError("INVALID", "The supplier shipment carries a different product.");
      await this.bumpVersion(tx, "SALES", shipment, `"primary_supplier_shipment_id" = '${input.supplierShipmentId}'::uuid`);
      await this.audit(tx, { tenantId: input.tenantId, kind: "SALES", shipment, actorId: input.actorId, action: "PRIMARY_SOURCE_SET", details: { supplierShipmentId: input.supplierShipmentId, reference: source.reference } });
      return this.readDetail(tx, input.tenantId, "SALES", shipment.id);
    });
  }

  /** Draft → confirmed in one step (no approval). The Approval row is kept, bound to this dataset hash, as the record of who confirmed it. */
  async submitForConfirmation(input: { tenantId: string; kind: ShipmentKind; shipmentId: string; expectedVersion: number; actorId: string; idempotencyKey?: string }): Promise<ShipmentDetail> {
    const k = KINDS[input.kind];
    return this.client.$transaction(async (tx) => {
      const shipment = await this.lock(tx, input.tenantId, input.kind, input.shipmentId, input.expectedVersion);
      if (shipment.execution_state !== "DRAFT") throw new ShipmentStoreError("CONFLICT", "Only a draft shipment can be submitted.");
      if (shipment.dataset_state === "PENDING_APPROVAL") throw new ShipmentStoreError("CONFLICT", "This shipment is already waiting for approval.");
      if (input.kind === "SALES") {
        if (!shipment.primary_supplier_shipment_id) throw new ShipmentStoreError("INVALID", "Choose the supplier shipment this customer shipment is sourced from before submitting.");
        const source = (await tx.$queryRawUnsafe<Array<{ execution_state: string }>>(`SELECT "execution_state"::text execution_state FROM "SupplierShipment" WHERE "id" = $1`, shipment.primary_supplier_shipment_id))[0];
        if (!source || ["CANCELLED", "REJECTED"].includes(source.execution_state)) throw new ShipmentStoreError("INVALID", "The source supplier shipment was cancelled or rejected. Choose another source.");
      }
      const approvalId = (await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "Approval" ("action_code","subject_type","subject_id","subject_version","subject_hash","requester_id","decision")
         VALUES ($1::"ApprovalActionCode",$2,$3,$4,$5,$6,'PENDING') RETURNING "id"::text id`,
        k.approvalAction, input.kind, shipment.id, Number(shipment.version) + 1, shipment.dataset_hash, input.actorId))[0].id;
      // No approval step: confirming saves the shipment as confirmed at once. The Approval row records who confirmed it.
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = 'APPROVED', "decided_at" = NOW(), "comment" = 'Confirmed' WHERE "id" = $1`, approvalId);
      await tx.$executeRawUnsafe(`UPDATE ${k.datasetTable} SET "state" = 'APPROVED', "approval_id" = $1 WHERE "id" = $2`, approvalId, shipment.active_dataset_id);
      await this.executionEvent(tx, { kind: input.kind, shipment, from: "DRAFT", to: "CONFIRMED", actorId: input.actorId, reason: null, idempotencyKey: input.idempotencyKey ?? crypto.randomUUID() });
      await this.bumpVersion(tx, input.kind, shipment, `"execution_state" = 'CONFIRMED'`);
      await this.audit(tx, { tenantId: input.tenantId, kind: input.kind, shipment, actorId: input.actorId, action: "CONFIRMATION_APPROVED", details: { approvalId, datasetId: shipment.active_dataset_id, comment: "Confirmed without an approval step" } });
      return this.readDetail(tx, input.tenantId, input.kind, shipment.id);
    });
  }

  /**
   * Owner decision on a pending confirmation. Approval confirms the shipment in the same transaction;
   * rejection returns the dataset to draft so it can be corrected and resubmitted.
   */
  async decide(input: { tenantId: string; approvalId: string; approverId: string; decision: "APPROVED" | "REJECTED"; comment: string | null; idempotencyKey: string }): Promise<ShipmentDetail> {
    const subject = await this.approvalSubject(input.tenantId, input.approvalId);
    if (!subject) throw new ShipmentStoreError("NOT_FOUND", "Approval not found");
    const k = KINDS[subject.kind];
    return this.client.$transaction(async (tx) => {
      const shipment = await this.lock(tx, input.tenantId, subject.kind, subject.shipmentId);
      const approval = (await tx.$queryRawUnsafe<Array<{ decision: string; subject_hash: string; requester_id: string }>>(
        `SELECT "decision"::text decision, "subject_hash", "requester_id" FROM "Approval" WHERE "id" = $1 FOR UPDATE`, input.approvalId))[0];
      if (!approval || approval.decision !== "PENDING") throw new ShipmentStoreError("CONFLICT", "This approval was already decided.");
      if (approval.requester_id === input.approverId) throw new ShipmentStoreError("INVALID", "You cannot approve your own request.");
      if (shipment.dataset_approval_id !== input.approvalId || approval.subject_hash !== shipment.dataset_hash) {
        throw new ShipmentStoreError("CONFLICT", "The shipment changed after it was submitted. It must be submitted again.");
      }
      if (input.decision === "APPROVED" && subject.kind === "SALES") {
        const source = (await tx.$queryRawUnsafe<Array<{ execution_state: string }>>(`SELECT "execution_state"::text execution_state FROM "SupplierShipment" WHERE "id" = $1`, shipment.primary_supplier_shipment_id))[0];
        if (!source || ["CANCELLED", "REJECTED"].includes(source.execution_state)) throw new ShipmentStoreError("INVALID", "The source supplier shipment was cancelled or rejected. Reject this request so the source can be changed.");
      }
      await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = $2::"ApprovalDecision", "approver_id" = $3, "decided_at" = NOW(), "comment" = $4 WHERE "id" = $1`,
        input.approvalId, input.decision, input.approverId, input.comment);
      if (input.decision === "APPROVED") {
        await tx.$executeRawUnsafe(`UPDATE ${k.datasetTable} SET "state" = 'APPROVED' WHERE "id" = $1`, shipment.active_dataset_id);
        await this.executionEvent(tx, { kind: subject.kind, shipment, from: "DRAFT", to: "CONFIRMED", actorId: input.approverId, reason: input.comment, idempotencyKey: input.idempotencyKey });
        await this.bumpVersion(tx, subject.kind, shipment, `"execution_state" = 'CONFIRMED'`);
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE ${k.datasetTable} SET "state" = 'DRAFT', "approval_id" = NULL, "invalidated_approval_ids" = array_append("invalidated_approval_ids", $2::uuid) WHERE "id" = $1`,
          shipment.active_dataset_id, input.approvalId);
        await this.bumpVersion(tx, subject.kind, shipment);
      }
      await this.audit(tx, { tenantId: input.tenantId, kind: subject.kind, shipment, actorId: input.approverId, action: input.decision === "APPROVED" ? "CONFIRMATION_APPROVED" : "CONFIRMATION_REJECTED", details: { approvalId: input.approvalId, comment: input.comment } });
      return this.readDetail(tx, input.tenantId, subject.kind, shipment.id);
    });
  }

  async transition(input: { tenantId: string; kind: ShipmentKind; shipmentId: string; expectedVersion: number; actorId: string; toState: ExecutionState; reason: string | null; idempotencyKey: string }): Promise<ShipmentDetail> {
    const k = KINDS[input.kind];
    return this.client.$transaction(async (tx) => {
      const shipment = await this.lock(tx, input.tenantId, input.kind, input.shipmentId, input.expectedVersion);
      const from = shipment.execution_state;
      if (!TRANSITIONS[input.kind].has(`${from}->${input.toState}`)) {
        throw new ShipmentStoreError("CONFLICT", `A ${from.toLowerCase().replace("_", " ")} shipment cannot move to ${input.toState.toLowerCase().replace("_", " ")}.`);
      }
      if (input.kind === "SALES" && input.toState === "IN_TRANSIT" && shipment.primary_supplier_shipment_id) {
        const source = (await tx.$queryRawUnsafe<Array<{ execution_state: string }>>(`SELECT "execution_state"::text execution_state FROM "SupplierShipment" WHERE "id" = $1`, shipment.primary_supplier_shipment_id))[0];
        if (!source || ["CANCELLED", "REJECTED"].includes(source.execution_state)) throw new ShipmentStoreError("INVALID", "The source supplier shipment was cancelled or rejected.");
      }
      if (from === "DRAFT" && shipment.dataset_state === "PENDING_APPROVAL" && shipment.dataset_approval_id) {
        // Cancelling a draft withdraws its pending approval request.
        await tx.$executeRawUnsafe(`UPDATE "Approval" SET "decision" = 'EXPIRED', "decided_at" = NOW() WHERE "id" = $1 AND "decision" = 'PENDING'`, shipment.dataset_approval_id);
        await tx.$executeRawUnsafe(`UPDATE ${k.datasetTable} SET "state" = 'DRAFT', "approval_id" = NULL, "invalidated_approval_ids" = array_append("invalidated_approval_ids", $2::uuid) WHERE "id" = $1`, shipment.active_dataset_id, shipment.dataset_approval_id);
      }
      await this.executionEvent(tx, { kind: input.kind, shipment, from, to: input.toState, actorId: input.actorId, reason: input.reason, idempotencyKey: input.idempotencyKey });
      await this.bumpVersion(tx, input.kind, shipment, `"execution_state" = '${input.toState}'`);
      await this.audit(tx, { tenantId: input.tenantId, kind: input.kind, shipment, actorId: input.actorId, action: "STATE_CHANGED", details: { from, to: input.toState, reason: input.reason } });
      return this.readDetail(tx, input.tenantId, input.kind, shipment.id);
    });
  }
}
