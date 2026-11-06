import { createHash } from "node:crypto";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { canonicalizeJson } from "../../platform/canonical-json/rfc8785.ts";

export const AUDIT_HASH_PAYLOAD_KEYS = [
  "id", "projectId", "sequenceNo", "actor", "sessionId", "action", "aggregateType", "aggregateId",
  "aggregateVersion", "beforeHash", "afterHash", "previousEventHash", "occurredAt", "reason",
  "correlationId", "idempotencyKey",
] as const;

type HashPayloadKey = (typeof AUDIT_HASH_PAYLOAD_KEYS)[number];

export interface AuditActorSnapshot {
  readonly userId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}

export interface AuditEvent extends Record<HashPayloadKey, unknown> {
  readonly id: string;
  readonly projectId: string;
  readonly sequenceNo: number;
  readonly actor: AuditActorSnapshot;
  readonly sessionId: string;
  readonly action: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly beforeHash: string | null;
  readonly afterHash: string;
  readonly previousEventHash: string | null;
  readonly occurredAt: string;
  readonly reason: string | null;
  readonly correlationId: string;
  readonly idempotencyKey: string | null;
  readonly eventHash: string;
}

export interface AuditAppendRepository<Transaction> {
  lockProjectTail(transaction: Transaction, projectId: string): Promise<AuditEvent | null>;
  insertEvent(transaction: Transaction, event: AuditEvent): Promise<void>;
}

const NULLABLE_KEYS = new Set<HashPayloadKey>(["beforeHash", "previousEventHash", "reason", "idempotencyKey"]);

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

export function buildAuditHashPayload(input: Record<string, unknown>): Record<HashPayloadKey, unknown> {
  const payload = {} as Record<HashPayloadKey, unknown>;
  for (const key of AUDIT_HASH_PAYLOAD_KEYS) {
    const value = input[key];
    if (value === undefined && !NULLABLE_KEYS.has(key)) {
      throw new TypeError(`audit hash payload requires ${key}`);
    }
    payload[key] = cloneJson(value ?? null);
  }
  return payload;
}

export function computeAuditEventHash(payload: Record<string, unknown>): string {
  const exactPayload = buildAuditHashPayload(payload);
  return createHash("sha256").update(canonicalizeJson(exactPayload), "utf8").digest("hex");
}

export async function appendAuditEvent<Transaction>(input: {
  readonly repository: AuditAppendRepository<Transaction>;
  readonly transaction: Transaction;
  readonly event: Record<string, unknown>;
}): Promise<AuditEvent> {
  const projectId = input.event.projectId;
  if (typeof projectId !== "string" || projectId.length === 0) throw new TypeError("audit event requires projectId");

  const tail = await input.repository.lockProjectTail(input.transaction, projectId);
  const payload = buildAuditHashPayload({
    ...input.event,
    actor: cloneJson(input.event.actor),
    sequenceNo: tail === null ? 1 : tail.sequenceNo + 1,
    previousEventHash: tail?.eventHash ?? null,
  });
  const event = Object.freeze({ ...payload, eventHash: computeAuditEventHash(payload) }) as AuditEvent;
  await input.repository.insertEvent(input.transaction, event);
  return event;
}
