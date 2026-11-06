import type { AuditAppendRepository, AuditEvent } from "./audit-service.ts";
import type { AuditPageRepository } from "./audit-query.ts";

interface AuditRow {
  id: string; project_id: string; sequence_no: bigint; actor_snapshot: unknown; session_id: string; action: string;
  aggregate_type: string; aggregate_id: string; aggregate_version: number; before_hash: string | null; after_hash: string;
  previous_event_hash: string | null; occurred_at: Date; reason: string | null; correlation_id: string; idempotency_key: string | null;
  event_hash: string;
}

export interface AuditTransactionClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  auditEvent: {
    findFirst(args: Record<string, unknown>): Promise<AuditRow | null>;
    findMany(args: Record<string, unknown>): Promise<AuditRow[]>;
    create(args: Record<string, unknown>): Promise<unknown>;
  };
}

function actorSnapshot(value: unknown): AuditEvent["actor"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid stored audit actor snapshot");
  const actor = value as Record<string, unknown>;
  if (typeof actor.userId !== "string" || typeof actor.displayName !== "string" ||
      !Array.isArray(actor.roles) || !actor.roles.every((role) => typeof role === "string")) {
    throw new Error("invalid stored audit actor snapshot");
  }
  return { userId: actor.userId, displayName: actor.displayName, roles: [...actor.roles] as string[] };
}

function toEvent(row: AuditRow): AuditEvent {
  const sequenceNo = Number(row.sequence_no);
  if (!Number.isSafeInteger(sequenceNo)) throw new Error("audit sequence exceeds safe API integer range");
  return {
    id: row.id, projectId: row.project_id, sequenceNo, actor: actorSnapshot(row.actor_snapshot), sessionId: row.session_id,
    action: row.action, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, aggregateVersion: row.aggregate_version,
    beforeHash: row.before_hash, afterHash: row.after_hash, previousEventHash: row.previous_event_hash,
    occurredAt: row.occurred_at.toISOString(), reason: row.reason, correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key, eventHash: row.event_hash,
  };
}

function encodeCursor(sequenceNo: number): string {
  return Buffer.from(JSON.stringify({ sequenceNo }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null): number | null {
  if (cursor === null) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { sequenceNo?: unknown };
    if (!Number.isSafeInteger(parsed.sequenceNo) || (parsed.sequenceNo as number) < 1) throw new Error();
    return parsed.sequenceNo as number;
  } catch {
    throw new TypeError("invalid audit cursor");
  }
}

export class PrismaAuditRepository implements AuditAppendRepository<AuditTransactionClient>, AuditPageRepository {
  constructor(private readonly client: AuditTransactionClient) {}

  async lockProjectTail(transaction: AuditTransactionClient, projectId: string): Promise<AuditEvent | null> {
    // Locking the Project row serializes genesis as well as non-genesis appends for this Project.
    await transaction.$queryRawUnsafe('SELECT "id" FROM "Project" WHERE "id" = $1::uuid FOR UPDATE', projectId);
    const row = await transaction.auditEvent.findFirst({ where: { project_id: projectId }, orderBy: { sequence_no: "desc" } });
    return row === null ? null : toEvent(row);
  }

  async insertEvent(transaction: AuditTransactionClient, event: AuditEvent): Promise<void> {
    await transaction.auditEvent.create({ data: {
      id: event.id, project_id: event.projectId, sequence_no: BigInt(event.sequenceNo), aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId, aggregate_version: event.aggregateVersion, action: event.action,
      actor_id: event.actor.userId, actor_snapshot: event.actor, session_id: event.sessionId,
      occurred_at: new Date(event.occurredAt), reason: event.reason, correlation_id: event.correlationId,
      idempotency_key: event.idempotencyKey, before_hash: event.beforeHash, after_hash: event.afterHash,
      previous_event_hash: event.previousEventHash, event_hash: event.eventHash,
    } });
  }

  async listProjectEvents(input: { projectId: string; cursor: string | null; limit: number }) {
    const afterSequence = decodeCursor(input.cursor);
    const rows = await this.client.auditEvent.findMany({
      where: { project_id: input.projectId, ...(afterSequence === null ? {} : { sequence_no: { gt: BigInt(afterSequence) } }) },
      orderBy: { sequence_no: "asc" }, take: input.limit + 1,
    });
    const visible = rows.slice(0, input.limit).map(toEvent);
    let pageStartPreviousEventHash: string | null = null;
    if (afterSequence !== null) {
      const prior = await this.client.auditEvent.findFirst({ where: { project_id: input.projectId, sequence_no: BigInt(afterSequence) } });
      if (prior === null) throw new TypeError("invalid audit cursor anchor");
      pageStartPreviousEventHash = prior.event_hash;
    }
    return {
      items: visible,
      nextCursor: rows.length > input.limit && visible.length > 0 ? encodeCursor(visible.at(-1)!.sequenceNo) : null,
      pageStartPreviousEventHash,
    };
  }
}
