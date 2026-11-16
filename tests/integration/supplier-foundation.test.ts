import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { SupplierProblem, createSupplierService, supplierAuditAction, type SupplierRecord, type SupplierRepository } from "../../src/modules/suppliers/supplier-service.ts";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const actor = "33333333-3333-4333-8333-333333333333";
const admin = { tenantId: tenantA, userId: actor, roles: ["OWNER_ADMIN"] } as const;
class MemoryRepository implements SupplierRepository {
  records: SupplierRecord[] = []; audit: Array<Record<string, unknown>> = [];
  async list(tenantId: string) { return this.records.filter((row) => row.tenantId === tenantId); }
  async get(tenantId: string, id: string) { return this.records.find((row) => row.tenantId === tenantId && row.id === id) ?? null; }
  async create(input: Parameters<SupplierRepository["create"]>[0]) {
    if (this.records.some((r) => r.tenantId === input.tenantId && r.reference === input.values.reference)) throw new SupplierProblem("DUPLICATE_REFERENCE", 409);
    const row: SupplierRecord = { id: crypto.randomUUID(), tenantId: input.tenantId, ...input.values, version: 1, createdAt: "2026-11-16T10:00:00Z", updatedAt: "2026-11-16T10:00:00Z" };
    this.records.push(row); this.audit.push({ tenantId: input.tenantId, actorId: input.actorId, action: "SUPPLIER_CREATED", after: row }); return row;
  }
  async update(input: Parameters<SupplierRepository["update"]>[0]) {
    const i = this.records.findIndex((r) => r.tenantId === input.tenantId && r.id === input.id); if (i < 0) return null;
    const before = this.records[i]; if (before.version !== input.expectedVersion) throw new SupplierProblem("STALE_VERSION", 412);
    const after = { ...before, ...input.values, version: before.version + 1, updatedAt: "2026-11-16T10:01:00Z" }; this.records[i] = after;
    this.audit.push({ tenantId: input.tenantId, actorId: input.actorId, action: supplierAuditAction(before.status, after.status), before, after }); return after;
  }
}

test("supplier schema is tenant-owned and audit is append-only", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/202611160003_supplier_foundation/migration.sql", "utf8");
  assert.match(schema, /model Supplier \{[\s\S]*tenant_id[\s\S]*registered_name[\s\S]*display_name_ar[\s\S]*@@unique\(\[tenant_id, reference\]\)/);
  assert.match(migration, /Supplier_tenant_id_reference_key/); assert.match(migration, /SupplierAuditEvent_append_only/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON "SupplierAuditEvent" FROM orb_app/);
  assert.doesNotMatch(migration, /INSERT INTO "Supplier"|INSERT INTO "Party"/);
});

test("supplier lifecycle validates, normalizes, scopes, authorizes and versions", async () => {
  const repository = new MemoryRepository(); const service = createSupplierService(repository);
  const created = await service.create({ principal: admin, input: { reference: " sup-1 ", registeredName: " Atlas Coffee ", displayNameAr: " أطلس للقهوة ", countryCode: " gb ", contactName: " Hana ", email: "BUY@EXAMPLE.COM", phone: "+251 911 000 000", paymentCurrency: " gbp ", paymentTermsDays: 30 } });
  assert.deepEqual({ reference: created.reference, registeredName: created.registeredName, displayNameAr: created.displayNameAr, countryCode: created.countryCode, email: created.email, paymentCurrency: created.paymentCurrency }, { reference: "SUP-1", registeredName: "Atlas Coffee", displayNameAr: "أطلس للقهوة", countryCode: "GB", email: "buy@example.com", paymentCurrency: "GBP" });
  await service.create({ principal: { ...admin, tenantId: tenantB }, input: { reference: "SUP-1", registeredName: "Other", displayNameAr: "آخر", countryCode: "BR", email: "other@example.com", paymentCurrency: "BRL", paymentTermsDays: 0 } });
  assert.equal((await service.list({ principal: { ...admin, roles: ["FINANCE_VIEWER"] } })).length, 1);
  await assert.rejects(() => service.create({ principal: { ...admin, roles: ["FINANCE_VIEWER"] }, input: {} }), (e: unknown) => e instanceof SupplierProblem && e.code === "PERMISSION_DENIED");
  const archived = await service.update({ principal: admin, id: created.id, expectedVersion: 1, input: { status: "INACTIVE" } });
  assert.equal(archived.version, 2); assert.equal(archived.status, "INACTIVE");
  const editedArchived = await service.update({ principal: admin, id: created.id, expectedVersion: 2, input: { registeredName: "Atlas Coffee Ltd" } });
  assert.equal(repository.audit.at(-1)?.action, "SUPPLIER_UPDATED");
  const reactivated = await service.update({ principal: admin, id: created.id, expectedVersion: 3, input: { status: "ACTIVE" } });
  assert.equal(reactivated.status, "ACTIVE"); assert.equal(repository.audit.at(-1)?.action, "SUPPLIER_REACTIVATED");
  await assert.rejects(() => service.update({ principal: admin, id: created.id, expectedVersion: 3, input: { registeredName: "Stale" } }), (e: unknown) => e instanceof SupplierProblem && e.code === "STALE_VERSION");
  await assert.rejects(() => service.get({ principal: { ...admin, tenantId: tenantB }, id: created.id }), (e: unknown) => e instanceof SupplierProblem && e.code === "RESOURCE_NOT_FOUND");
});

test("supplier rejects unknown fields, invalid country/currency/terms and missing contact", async () => {
  const service = createSupplierService(new MemoryRepository());
  for (const input of [
    { reference: "S-1", registeredName: "A", displayNameAr: "أ", countryCode: "GB", paymentCurrency: "GBP", paymentTermsDays: 0 },
    { reference: "S-1", registeredName: "A", displayNameAr: "أ", countryCode: "ZZ", email: "a@example.com", paymentCurrency: "GBP", paymentTermsDays: 0 },
    { reference: "S-1", registeredName: "A", displayNameAr: "أ", countryCode: "GB", email: "a@example.com", paymentCurrency: "US", paymentTermsDays: -1 },
    { reference: "S-1", registeredName: "A", displayNameAr: "أ", countryCode: "GB", email: "a@example.com", paymentCurrency: "GBP", paymentTermsDays: 0, tenantId: tenantB },
  ]) await assert.rejects(() => service.create({ principal: admin, input }), (e: unknown) => e instanceof SupplierProblem && e.code === "VALIDATION_FAILED");
});
