import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000001";
const ACTOR_ID = "019a5f9b-7c00-7000-8000-000000000002";
const SESSION_ID = "019a5f9b-7c00-7000-8000-000000000003";
const AGGREGATE_ID = "019a5f9b-7c00-7000-8000-000000000004";
const HASH_A = "a".repeat(64);

interface ActorSnapshot {
  readonly userId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}

interface AuditEvent {
  readonly id: string;
  readonly projectId: string;
  readonly sequenceNo: number;
  readonly actor: ActorSnapshot;
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

interface AuditModule {
  readonly AUDIT_HASH_PAYLOAD_KEYS: readonly string[];
  buildAuditHashPayload(input: Record<string, unknown>): Record<string, unknown>;
  computeAuditEventHash(payload: Record<string, unknown>): string;
  appendAuditEvent(input: {
    readonly repository: {
      lockProjectTail(transaction: object, projectId: string): Promise<AuditEvent | null>;
      insertEvent(transaction: object, event: AuditEvent): Promise<void>;
    };
    readonly transaction: object;
    readonly event: Record<string, unknown>;
  }): Promise<AuditEvent>;
}

async function loadAuditModule(): Promise<AuditModule> {
  const modulePath = "../../../src/modules/audit/audit-service.ts";
  return import(modulePath) as Promise<AuditModule>;
}

function eventInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "019a5f9b-7c00-7000-8000-000000000005",
    projectId: PROJECT_ID,
    actor: { userId: ACTOR_ID, displayName: "Operations User", roles: ["OPERATIONS"] },
    sessionId: SESSION_ID,
    action: "PROJECT_UPDATED",
    aggregateType: "Project",
    aggregateId: AGGREGATE_ID,
    aggregateVersion: 2,
    beforeHash: null,
    afterHash: HASH_A,
    occurredAt: "2026-11-06T12:34:56.000Z",
    reason: null,
    correlationId: "correlation-audit-1",
    idempotencyKey: null,
    ...overrides,
  };
}

/** Independent test oracle for the JSON types used by an audit payload. */
function independentJcs(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "JCS rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentJcs).join(",")}]`;
  assert.equal(typeof value, "object");
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${independentJcs(object[key])}`).join(",")}}`;
}

function independentHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(independentJcs(payload), "utf8").digest("hex");
}

class MemoryAuditRepository {
  readonly events = new Map<string, AuditEvent[]>();
  readonly transactions: object[] = [];

  async lockProjectTail(transaction: object, projectId: string): Promise<AuditEvent | null> {
    this.transactions.push(transaction);
    return this.events.get(projectId)?.at(-1) ?? null;
  }

  async insertEvent(transaction: object, event: AuditEvent): Promise<void> {
    this.transactions.push(transaction);
    const rows = this.events.get(event.projectId) ?? [];
    rows.push(structuredClone(event));
    this.events.set(event.projectId, rows);
  }
}

test("audit hash payload has exactly the RFC 8785 contract keys with explicit nulls", async () => {
  const audit = await loadAuditModule();
  const payload = audit.buildAuditHashPayload({ ...eventInput(), sequenceNo: 1, previousEventHash: null, ignoredSecret: "must-not-be-hashed" });
  const expectedKeys = [
    "id", "projectId", "sequenceNo", "actor", "sessionId", "action", "aggregateType", "aggregateId",
    "aggregateVersion", "beforeHash", "afterHash", "previousEventHash", "occurredAt", "reason",
    "correlationId", "idempotencyKey",
  ];

  assert.deepEqual(audit.AUDIT_HASH_PAYLOAD_KEYS, expectedKeys);
  assert.deepEqual(Object.keys(payload).sort(), [...expectedKeys].sort());
  assert.equal(payload.beforeHash, null);
  assert.equal(payload.reason, null);
  assert.equal(payload.idempotencyKey, null);
  assert.equal(payload.previousEventHash, null);
  assert.equal(Object.hasOwn(payload, "ignoredSecret"), false);
  assert.equal(audit.computeAuditEventHash(payload), independentHash(payload));
  assert.match(audit.computeAuditEventHash(payload), /^[a-f0-9]{64}$/);
});

test("append allocates a per-Project sequence and genesis/link hashes inside the caller transaction", async () => {
  const audit = await loadAuditModule();
  const repository = new MemoryAuditRepository();
  const transaction = { id: "business-transaction" };
  const first = await audit.appendAuditEvent({ repository, transaction, event: eventInput() });
  const second = await audit.appendAuditEvent({
    repository,
    transaction,
    event: eventInput({
      id: "019a5f9b-7c00-7000-8000-000000000006",
      aggregateVersion: 3,
      beforeHash: HASH_A,
      afterHash: "b".repeat(64),
      correlationId: "correlation-audit-2",
      idempotencyKey: "0123456789abcdef",
    }),
  });
  const otherProject = await audit.appendAuditEvent({
    repository,
    transaction,
    event: eventInput({ id: "019a5f9b-7c00-7000-8000-000000000007", projectId: "019a5f9b-7c00-7000-8000-000000000008" }),
  });

  assert.equal(first.sequenceNo, 1);
  assert.equal(first.previousEventHash, null);
  assert.equal(second.sequenceNo, 2);
  assert.equal(second.previousEventHash, first.eventHash);
  assert.equal(otherProject.sequenceNo, 1);
  assert.equal(otherProject.previousEventHash, null);
  assert.ok(repository.transactions.every((seen) => seen === transaction), "lock and insert must use the business transaction");
});

test("stored actor/session snapshots and every chain hash recompute independently", async () => {
  const audit = await loadAuditModule();
  const repository = new MemoryAuditRepository();
  const actor = { userId: ACTOR_ID, displayName: "Original Name", roles: ["OPERATIONS"] };
  const event = await audit.appendAuditEvent({ repository, transaction: {}, event: eventInput({ actor }) });
  actor.displayName = "Renamed Later";
  actor.roles.push("OWNER_ADMIN");

  assert.deepEqual(event.actor, { userId: ACTOR_ID, displayName: "Original Name", roles: ["OPERATIONS"] });
  const { eventHash: _excluded, ...payload } = event;
  assert.equal(event.eventHash, independentHash(payload));
  assert.equal(repository.events.get(PROJECT_ID)?.[0].eventHash, event.eventHash);
});

test("database migration denies AuditEvent update/delete to both triggers and the application role", () => {
  const migration = readFileSync("prisma/migrations/202611050001_r1_initial/migration.sql", "utf8");
  assert.match(migration, /CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent"/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON[\s\S]*"AuditEvent" FROM orb_app/);
  assert.match(migration, /RAISE EXCEPTION 'immutable ORB record: %'/);
});
