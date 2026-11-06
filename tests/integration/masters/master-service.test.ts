import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import { InMemoryIdempotencyStore } from "../../../src/platform/idempotency/store.ts";

const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000411", roles: ["OWNER_ADMIN"] });
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000412", roles: ["OPERATIONS"] });
const FINANCE = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000413", roles: ["FINANCE_VIEWER"] });

type MasterType = "customers" | "suppliers" | "coffee" | "currencies" | "expense-categories";
type Principal = Readonly<{ userId: string; roles: readonly string[] }>;
type MasterRecord = Readonly<Record<string, unknown> & { id: string; version: number }>;
interface MasterService {
  list(input: { masterType: MasterType; principal: Principal }): Promise<readonly MasterRecord[]>;
  create(input: { masterType: MasterType; payload: Record<string, unknown>; principal: Principal; idempotencyKey: string; correlationId: string; locale?: string }): Promise<{ value: MasterRecord; replayed: boolean }>;
  update(input: { masterType: MasterType; recordId: string; payload: Record<string, unknown>; expectedVersion: number; principal: Principal; idempotencyKey: string; correlationId: string; locale?: string }): Promise<{ value: MasterRecord; replayed: boolean }>;
}
interface MasterModule {
  createInMemoryMasterService(input: { idempotencyStore: InMemoryIdempotencyStore; now: () => string }): MasterService;
  readMasterAuditEvents(service: MasterService): readonly Readonly<Record<string, unknown>>[];
}
async function loadMasters(): Promise<MasterModule> {
  return import("../../../src/modules/masters/master-service.ts") as Promise<MasterModule>;
}
function isProblem(code: string, status?: number, title?: string) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status)
    && (title === undefined || error.problem.title === title);
}
async function service(): Promise<{ masters: MasterModule; subject: MasterService }> {
  const masters = await loadMasters();
  return { masters, subject: masters.createInMemoryMasterService({ idempotencyStore: new InMemoryIdempotencyStore(), now: () => "2026-11-06T12:00:00.000Z" }) };
}
const common = (key: string) => ({ principal: OPERATIONS, idempotencyKey: key, correlationId: key });

test("creates and lists customer/supplier, coffee, fixed currencies and expense categories", async () => {
  const { subject } = await service();
  const fixtures: Array<[MasterType, Record<string, unknown>]> = [
    ["customers", { reference: "CUST-001", legalNameAr: "عميل", legalNameEn: "Customer", countryCode: "AE", sensitiveIdentity: "784-secret" }],
    ["suppliers", { reference: "SUP-001", legalNameAr: "مورد", legalNameEn: "Supplier", countryCode: "BR", sensitiveIdentity: "tax-secret" }],
    ["coffee", { reference: "COF-001", origin: "BR", type: "Arabica", grade: "NY2", cropYear: "2026", bagType: "JUTE", standardBagWeight: "60.000000", attributes: { process: "natural" } }],
    ["currencies", { code: "AED", decimals: 2 }],
    ["currencies", { code: "USD", decimals: 2 }],
    ["currencies", { code: "SAR", decimals: 2 }],
    ["expense-categories", { code: "FREIGHT", nameAr: "شحن", nameEn: "Freight" }],
  ];
  for (const [index, [masterType, payload]] of fixtures.entries()) {
    const result = await subject.create({ masterType, payload, ...common(`master-create-${String(index).padStart(4, "0")}`) });
    assert.equal(result.replayed, false);
    assert.equal(result.value.version, 1);
  }
  assert.equal((await subject.list({ masterType: "customers", principal: OWNER })).length, 1);
  assert.equal((await subject.list({ masterType: "suppliers", principal: OPERATIONS })).length, 1);
  assert.deepEqual((await subject.list({ masterType: "currencies", principal: FINANCE })).map((row) => row.code), ["AED", "SAR", "USD"]);
  await assert.rejects(() => subject.create({ masterType: "currencies", payload: { code: "EUR", decimals: 2 }, ...common("master-currency-bad") }), isProblem("VALIDATION_FAILED", 400));
});

test("all roles may list, only Owner and Operations may mutate, and sensitive identity is shaped", async () => {
  const { subject } = await service();
  const created = await subject.create({ masterType: "customers", payload: { reference: "CUST-002", legalNameAr: "خاص", legalNameEn: "Private", countryCode: "AE", sensitiveIdentity: "secret-id" }, ...common("master-role-create") });
  for (const principal of [OWNER, OPERATIONS, FINANCE]) assert.equal((await subject.list({ masterType: "customers", principal })).length, 1);
  assert.equal((await subject.list({ masterType: "customers", principal: OWNER }))[0].sensitiveIdentity, "secret-id");
  for (const principal of [OPERATIONS, FINANCE]) assert.equal("sensitiveIdentity" in (await subject.list({ masterType: "customers", principal }))[0], false);
  await assert.rejects(() => subject.create({ masterType: "expense-categories", payload: { code: "DUTY", nameAr: "رسوم", nameEn: "Duty" }, principal: FINANCE, idempotencyKey: "master-finance-create", correlationId: "master-finance-create" }), isProblem("PERMISSION_DENIED", 403));
  await assert.rejects(() => subject.update({ masterType: "customers", recordId: created.value.id, payload: { active: false }, expectedVersion: 1, principal: FINANCE, idempotencyKey: "master-finance-update", correlationId: "master-finance-update" }), isProblem("PERMISSION_DENIED", 403));
});

test("references are unique in their master scope and records archive without deletion", async () => {
  const { subject } = await service();
  const first = await subject.create({ masterType: "suppliers", payload: { reference: "SUP-002", legalNameAr: "مورد", legalNameEn: "Supplier", countryCode: "AE" }, ...common("master-unique-first") });
  await assert.rejects(() => subject.create({ masterType: "suppliers", payload: { reference: "SUP-002", legalNameAr: "آخر", legalNameEn: "Duplicate", countryCode: "AE" }, ...common("master-unique-second") }), isProblem("DUPLICATE_REFERENCE", 409));
  const archived = await subject.update({ masterType: "suppliers", recordId: first.value.id, payload: { active: false }, expectedVersion: 1, ...common("master-archive-0001") });
  assert.equal(archived.value.active, false);
  assert.equal(archived.value.version, 2);
  assert.equal((await subject.list({ masterType: "suppliers", principal: OWNER })).length, 1, "archive preserves the business record");
});

test("updates reject stale versions, exact replay is harmless and changed replay fails", async () => {
  const { subject } = await service();
  const created = await subject.create({ masterType: "expense-categories", payload: { code: "INSURANCE", nameAr: "تأمين", nameEn: "Insurance" }, ...common("master-replay-create") });
  const command = { masterType: "expense-categories" as const, recordId: created.value.id, payload: { nameEn: "Cargo insurance" }, expectedVersion: 1, ...common("master-replay-update") };
  const first = await subject.update(command);
  const replay = await subject.update(command);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  await assert.rejects(() => subject.update({ ...command, payload: { nameEn: "Changed payload" } }), isProblem("IDEMPOTENCY_KEY_REUSED", 409));
  await assert.rejects(() => subject.update({ ...command, idempotencyKey: "master-stale-update", correlationId: "master-stale-update", expectedVersion: 1 }), isProblem("STALE_VERSION", 412));
});

test("validation problems localize safely and every mutation appends actor/version audit evidence", async () => {
  const { masters, subject } = await service();
  await assert.rejects(() => subject.create({ masterType: "coffee", payload: { reference: "" }, principal: OPERATIONS, idempotencyKey: "master-invalid-ar", correlationId: "master-invalid-ar", locale: "ar" }), isProblem("VALIDATION_FAILED", 400, "فشل التحقق"));
  const created = await subject.create({ masterType: "expense-categories", payload: { code: "HANDLING", nameAr: "مناولة", nameEn: "Handling" }, ...common("master-audit-create") });
  await subject.update({ masterType: "expense-categories", recordId: created.value.id, payload: { active: false }, expectedVersion: 1, ...common("master-audit-update") });
  const events = masters.readMasterAuditEvents(subject);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => [event.action, event.actorId, event.aggregateVersion]), [
    ["MASTER_CREATED", OPERATIONS.userId, 1], ["MASTER_ARCHIVED", OPERATIONS.userId, 2],
  ]);
  assert.ok(events.every((event) => event.occurredAt === "2026-11-06T12:00:00.000Z" && typeof event.afterHash === "string"));
});
