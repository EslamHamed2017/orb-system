import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Native Node TypeScript tests require source extensions.
import { CustomerProblem, createCustomerService, type CustomerRecord, type CustomerRepository } from "../../../src/modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaCustomerRepository } from "../../../src/modules/customers/customer-repository.ts";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const actor = "33333333-3333-4333-8333-333333333333";
const admin = { tenantId: tenantA, userId: actor, roles: ["OWNER_ADMIN"] } as const;

class MemoryRepository implements CustomerRepository {
  records: CustomerRecord[] = [];
  audit: Array<Record<string, unknown>> = [];
  async list(tenantId: string) { return this.records.filter((row) => row.tenantId === tenantId); }
  async get(tenantId: string, id: string) { return this.records.find((row) => row.tenantId === tenantId && row.id === id) ?? null; }
  async create(input: Parameters<CustomerRepository["create"]>[0]) {
    if (this.records.some((row) => row.tenantId === input.tenantId && row.reference === input.values.reference)) throw new CustomerProblem("DUPLICATE_REFERENCE", 409);
    const row: CustomerRecord = { id: crypto.randomUUID(), tenantId: input.tenantId, ...input.values, version: 1, createdAt: "2026-11-15T10:00:00.000Z", updatedAt: "2026-11-15T10:00:00.000Z" };
    this.records.push(row); this.audit.push({ tenantId: input.tenantId, customerId: row.id, actorId: input.actorId, action: "CUSTOMER_CREATED", aggregateVersion: 1, after: row }); return row;
  }
  async update(input: Parameters<CustomerRepository["update"]>[0]) {
    const index = this.records.findIndex((row) => row.tenantId === input.tenantId && row.id === input.id);
    if (index < 0) return null;
    const current = this.records[index];
    if (current.version !== input.expectedVersion) throw new CustomerProblem("STALE_VERSION", 412);
    if (this.records.some((row, candidate) => candidate !== index && row.tenantId === input.tenantId && row.reference === (input.values.reference ?? current.reference))) throw new CustomerProblem("DUPLICATE_REFERENCE", 409);
    const next = { ...current, ...input.values, version: current.version + 1, updatedAt: "2026-11-15T10:01:00.000Z" };
    this.records[index] = next; this.audit.push({ tenantId: input.tenantId, customerId: next.id, actorId: input.actorId, action: "CUSTOMER_UPDATED", aggregateVersion: next.version, before: current, after: next }); return next;
  }
}

test("schema and migration make customers tenant-owned, constrained, and audit append-only", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/202611150001_customer_foundation/migration.sql", "utf8");
  assert.match(schema, /model Tenant \{/);
  assert.match(schema, /model Customer \{[\s\S]*tenant_id[\s\S]*@@unique\(\[tenant_id, reference\]\)/);
  assert.match(schema, /model CustomerAuditEvent \{[\s\S]*tenant_id[\s\S]*before[\s\S]*after/);
  assert.match(migration, /Customer_tenant_id_reference_key/);
  assert.match(migration, /Customer_version_positive/);
  assert.match(migration, /Customer_contact_required/);
  assert.match(migration, /CustomerAuditEvent_append_only/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON "CustomerAuditEvent" FROM orb_app/);
  assert.doesNotMatch(migration, /INSERT INTO "Tenant"|INSERT INTO "Customer"/);
});

test("create validates and normalizes strictly, scopes to the principal tenant, and records actor audit", async () => {
  const repository = new MemoryRepository();
  const service = createCustomerService(repository);
  const created = await service.create({ principal: admin, input: { reference: " cust-001 ", legalName: " Acme Trading ", contactName: "  Sam Lee ", email: " SALES@EXAMPLE.COM ", phone: "+971 50 123 4567" } });
  assert.equal(created.reference, "CUST-001");
  assert.equal(created.legalName, "Acme Trading");
  assert.equal(created.email, "sales@example.com");
  assert.equal(repository.audit[0].tenantId, tenantA);
  assert.equal(repository.audit[0].actorId, actor);
  await assert.rejects(() => service.create({ principal: admin, input: { reference: "C-2", legalName: "Valid", phone: "+1234567", tenantId: tenantB } as never }), (error: unknown) => error instanceof CustomerProblem && error.code === "VALIDATION_FAILED");
});

test("validation rejects missing contact, malformed fields, and unknown status", async () => {
  const service = createCustomerService(new MemoryRepository());
  for (const input of [
    { reference: "C-1", legalName: "Customer" },
    { reference: "bad ref", legalName: "Customer", email: "not-email" },
    { reference: "C-1", legalName: "Customer", phone: "+1234567", status: "DELETED" },
  ]) await assert.rejects(() => service.create({ principal: admin, input: input as never }), (error: unknown) => error instanceof CustomerProblem && error.code === "VALIDATION_FAILED");
});

test("roles are enforced server-side and all reads remain tenant-scoped", async () => {
  const repository = new MemoryRepository();
  const service = createCustomerService(repository);
  await service.create({ principal: admin, input: { reference: "A-1", legalName: "Tenant A", email: "a@example.com" } });
  await service.create({ principal: { ...admin, tenantId: tenantB }, input: { reference: "A-1", legalName: "Tenant B", email: "b@example.com" } });
  assert.deepEqual((await service.list({ principal: { ...admin, roles: ["FINANCE_VIEWER"] } })).map((row) => row.legalName), ["Tenant A"]);
  await assert.rejects(() => service.create({ principal: { ...admin, roles: ["FINANCE_VIEWER"] }, input: { reference: "A-2", legalName: "Denied", email: "x@example.com" } }), (error: unknown) => error instanceof CustomerProblem && error.code === "PERMISSION_DENIED");
  await assert.rejects(() => service.list({ principal: { ...admin, roles: ["UNKNOWN"] } }), (error: unknown) => error instanceof CustomerProblem && error.code === "PERMISSION_DENIED");
});

test("updates use optimistic versions and audit immutable before/after tenant state", async () => {
  const repository = new MemoryRepository(); const service = createCustomerService(repository);
  const created = await service.create({ principal: admin, input: { reference: "A-1", legalName: "Before", email: "a@example.com" } });
  const updated = await service.update({ principal: admin, id: created.id, expectedVersion: 1, input: { legalName: "After", status: "INACTIVE" } });
  assert.equal(updated.version, 2); assert.equal(updated.status, "INACTIVE");
  assert.equal((repository.audit[1].before as CustomerRecord).legalName, "Before");
  assert.equal((repository.audit[1].after as CustomerRecord).legalName, "After");
  await assert.rejects(() => service.update({ principal: admin, id: created.id, expectedVersion: 2, input: { email: null } }), (error: unknown) => error instanceof CustomerProblem && error.code === "VALIDATION_FAILED");
  await assert.rejects(() => service.update({ principal: admin, id: created.id, expectedVersion: 1, input: { legalName: "Stale" } }), (error: unknown) => error instanceof CustomerProblem && error.code === "STALE_VERSION");
  await assert.rejects(() => service.update({ principal: { ...admin, tenantId: tenantB }, id: created.id, expectedVersion: 2, input: { legalName: "Cross tenant" } }), (error: unknown) => error instanceof CustomerProblem && error.code === "RESOURCE_NOT_FOUND");
});


test("Prisma repository applies tenant predicates and writes audit in the same transaction callback", async () => {
  const now = new Date("2026-11-15T10:00:00.000Z");
  const row = { id: "44444444-4444-4444-8444-444444444444", tenant_id: tenantA, reference: "C-1", legal_name: "Customer", contact_name: null, email: "a@example.com", phone: null, status: "ACTIVE" as const, version: 1, created_at: now, updated_at: now };
  const calls: Array<{ kind: string; args: Record<string, unknown> }> = [];
  const transaction = {
    async $queryRaw<T>(): Promise<T> { return [row] as T; },
    customer: {
      async findMany(args: Record<string, unknown>) { calls.push({ kind: "findMany", args }); return [row]; },
      async findFirst(args: Record<string, unknown>) { calls.push({ kind: "findFirst", args }); return row; },
      async create(args: Record<string, unknown>) { calls.push({ kind: "create", args }); return row; },
      async updateMany(args: Record<string, unknown>) { calls.push({ kind: "updateMany", args }); return { count: 1 }; },
    },
    customerAuditEvent: { async create(args: Record<string, unknown>) { calls.push({ kind: "audit", args }); return {}; } },
  };
  const repository = new PrismaCustomerRepository({ ...transaction, async $transaction<T>(work: (tx: typeof transaction) => Promise<T>) { calls.push({ kind: "transaction", args: {} }); return work(transaction); } });
  await repository.create({ tenantId: tenantA, actorId: actor, values: { reference: "C-1", legalName: "Customer", contactName: null, email: "a@example.com", phone: null, status: "ACTIVE" } });
  const created = calls.find((call) => call.kind === "create")!.args.data as Record<string, unknown>;
  const audited = calls.find((call) => call.kind === "audit")!.args.data as Record<string, unknown>;
  assert.equal(created.tenant_id, tenantA); assert.equal(audited.tenant_id, tenantA); assert.equal(audited.actor_id, actor);
  calls.length = 0;
  await repository.get(tenantB, row.id);
  assert.deepEqual(calls[0].args.where, { id: row.id, tenant_id: tenantB });
});


test("Prisma update locks and re-reads the tenant row before checking the expected version", async () => {
  const now = new Date("2026-11-15T10:00:00.000Z");
  const id = "44444444-4444-4444-8444-444444444444";
  const base = { id, tenant_id: tenantA, reference: "C-1", legal_name: "Before", contact_name: null, email: "a@example.com", phone: null, status: "ACTIVE" as const, version: 1, created_at: now, updated_at: now };
  let stored = base;
  let simulateWaitingWinner = true;
  const audits: Array<Record<string, unknown>> = [];
  const lockCalls: unknown[][] = [];
  const transaction = {
    async $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      lockCalls.push([strings, ...values]);
      // Simulate a concurrent transaction winning while this SELECT FOR UPDATE waits.
      if (simulateWaitingWinner) {
        stored = { ...stored, legal_name: "Winner", version: 2, updated_at: new Date("2026-11-15T10:00:30.000Z") };
        simulateWaitingWinner = false;
      }
      return [stored] as T;
    },
    customer: {
      async findMany() { return [stored]; },
      async findFirst() { return stored; },
      async create() { return stored; },
      async updateMany(args: Record<string, unknown>) {
        const where = args.where as { id: string; tenant_id: string; version: number };
        if (where.id !== stored.id || where.tenant_id !== stored.tenant_id || where.version !== stored.version) return { count: 0 };
        const update = args.data as { legal_name?: string; version: { increment: number }; updated_at: Date };
        stored = { ...stored, ...(update.legal_name === undefined ? {} : { legal_name: update.legal_name }), version: stored.version + update.version.increment, updated_at: update.updated_at };
        return { count: 1 };
      },
    },
    customerAuditEvent: { async create(args: Record<string, unknown>) { audits.push(args.data as Record<string, unknown>); return {}; } },
  };
  const repository = new PrismaCustomerRepository({ ...transaction, async $transaction<T>(work: (tx: typeof transaction) => Promise<T>) { return work(transaction); } });

  await assert.rejects(
    () => repository.update({ tenantId: tenantA, actorId: actor, id, expectedVersion: 1, values: { legalName: "Loser" } }),
    (error: unknown) => error instanceof CustomerProblem && error.code === "STALE_VERSION",
  );
  assert.equal(stored.legal_name, "Winner");
  assert.equal(audits.length, 0);

  const updated = await repository.update({ tenantId: tenantA, actorId: actor, id, expectedVersion: 2, values: { legalName: "After" } });
  assert.equal(updated?.version, 3);
  assert.equal(lockCalls.length, 2);
  const [strings, lockedId, lockedTenant] = lockCalls[1] as [TemplateStringsArray, string, string];
  assert.match(strings.join("?"), /SELECT[\s\S]+FROM "Customer"[\s\S]+FOR UPDATE/i);
  assert.equal(lockedId, id);
  assert.equal(lockedTenant, tenantA);
  assert.equal((audits[0].before as CustomerRecord).legalName, "Winner");
  assert.equal((audits[0].after as CustomerRecord).legalName, "After");
});
