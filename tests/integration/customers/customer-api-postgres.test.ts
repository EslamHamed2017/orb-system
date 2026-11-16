import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const uuid7 = () => { const value = randomUUID(); return `${value.slice(0, 14)}7${value.slice(15)}`; };
const integration = databaseUrl ? test : test.skip;

integration("production customer handlers persist a tenant-isolated audited lifecycle in PostgreSQL", async () => {
  // @ts-expect-error pg is a runtime dependency; the project intentionally omits its optional declarations.
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  const tenantId = uuid7(), otherTenantId = uuid7(), userId = uuid7();
  const token = `customer-api-${uuid7().replaceAll("-", "")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    await sql.query('INSERT INTO "Tenant" ("id","slug","name") VALUES ($1,$2,$3),($4,$5,$6)', [tenantId, `customer-${tenantId}`, "Customer API tenant", otherTenantId, `other-${otherTenantId}`, "Other tenant"]);
    await sql.query('INSERT INTO "User" ("id","auth_subject","name_ar","name_en","locale","status","mfa_state","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())', [userId, `customer-api-${userId}`, "مستخدم اختبار", "Customer API user", "en", "ACTIVE", "SATISFIED"]);
    await sql.query('INSERT INTO "UserRole" ("id","user_id","role") VALUES ($1,$2,$3)', [uuid7(), userId, "OPERATIONS"]);
    await sql.query('INSERT INTO "TenantMembership" ("id","tenant_id","user_id","status") VALUES ($1,$2,$3,$4)', [uuid7(), tenantId, userId, "ACTIVE"]);
    await sql.query("INSERT INTO \"Session\" (\"id\",\"user_id\",\"expires_at\",\"token_hash\",\"version\") VALUES ($1,$2,now() + interval '1 hour',$3,1)", [uuid7(), userId, tokenHash]);

    process.env.DATABASE_URL = databaseUrl;
    process.env.ORB_APP_ORIGIN = "https://orb.example";
    const collection = await import("../../../src/app/api/customers/route.ts");
    const record = await import("../../../src/app/api/customers/[customerId]/route.ts");
    const createKey = uuid7(), updateKey = uuid7();
    const csrfToken = createHash("sha256").update(`orb-customer-csrf\0${token}`).digest("hex");
    const headers = { cookie: `__Host-orb_session=${token}; __Host-orb_csrf=${csrfToken}`, "content-type": "application/json", origin: "https://orb.example", "x-csrf-token": csrfToken };
    const createRequest = () => collection.POST(new Request("https://orb.example/api/customers", { method: "POST", headers: { ...headers, "idempotency-key": createKey }, body: JSON.stringify({ reference: "CUS-DB-1", legalName: "Persisted Coffee Buyer", email: "buyer@example.test" }) }));
    const [createdResponse, replayedCreate] = await Promise.all([createRequest(), createRequest()]);
    assert.equal(createdResponse.status, 201);
    assert.equal(replayedCreate.status, 201);
    const created = await createdResponse.json() as { id: string; version: number; legalName: string };
    assert.equal(created.legalName, "Persisted Coffee Buyer");
    assert.deepEqual(await replayedCreate.json(), created);

    const listedResponse = await collection.GET(new Request("https://orb.example/api/customers", { headers }));
    assert.equal(listedResponse.status, 200);
    const listed = await listedResponse.json() as { items: Array<{ id: string }> };
    assert.deepEqual(listed.items.map((item) => item.id), [created.id]);

    const updateRequest = () => record.PATCH(new Request(`https://orb.example/api/customers/${created.id}`, { method: "PATCH", headers: { ...headers, "idempotency-key": updateKey, "if-match": '"1"' }, body: JSON.stringify({ legalName: "Persisted Coffee Buyer Ltd" }) }), { params: Promise.resolve({ customerId: created.id }) });
    const [updatedResponse, replayedConcurrentUpdate] = await Promise.all([updateRequest(), updateRequest()]);
    assert.equal(updatedResponse.status, 200);
    assert.equal(replayedConcurrentUpdate.status, 200);
    const updated = await updatedResponse.json() as { version: number; legalName: string };
    assert.equal(updated.version, 2);
    assert.deepEqual(await replayedConcurrentUpdate.json(), updated);
    const laterResponse = await record.PATCH(new Request(`https://orb.example/api/customers/${created.id}`, { method: "PATCH", headers: { ...headers, "idempotency-key": uuid7(), "if-match": '"2"' }, body: JSON.stringify({ legalName: "Later Name" }) }), { params: Promise.resolve({ customerId: created.id }) });
    assert.equal(laterResponse.status, 200);
    assert.equal((await laterResponse.json() as { version: number }).version, 3);
    const replayedUpdate = await record.PATCH(new Request(`https://orb.example/api/customers/${created.id}`, { method: "PATCH", headers: { ...headers, "idempotency-key": updateKey, "if-match": '"1"' }, body: JSON.stringify({ legalName: "Persisted Coffee Buyer Ltd" }) }), { params: Promise.resolve({ customerId: created.id }) });
    assert.equal(replayedUpdate.status, 200);
    assert.deepEqual(await replayedUpdate.json(), updated);

    const audit = await sql.query('SELECT "action","aggregate_version","actor_id" FROM "CustomerAuditEvent" WHERE "customer_id"=$1 ORDER BY "aggregate_version"', [created.id]);
    assert.deepEqual(audit.rows.map((row: Record<string, unknown>) => [row.action, row.aggregate_version, row.actor_id]), [["CUSTOMER_CREATED", 1, userId], ["CUSTOMER_UPDATED", 2, userId], ["CUSTOMER_UPDATED", 3, userId]]);
    await sql.query('UPDATE "TenantMembership" SET tenant_id=$1 WHERE user_id=$2', [otherTenantId, userId]);
    const crossTenantReplay = await collection.POST(new Request("https://orb.example/api/customers", { method: "POST", headers: { ...headers, "idempotency-key": createKey }, body: JSON.stringify({ reference: "CUS-DB-1", legalName: "Persisted Coffee Buyer", email: "buyer@example.test" }) }));
    assert.equal(crossTenantReplay.status, 409);
    await sql.query('UPDATE "TenantMembership" SET tenant_id=$1 WHERE user_id=$2', [tenantId, userId]);
    const otherTenantRows = await sql.query('SELECT count(*)::int AS count FROM "Customer" WHERE "tenant_id"=$1', [otherTenantId]);
    assert.equal(otherTenantRows.rows[0].count, 0);
  } finally {
    await sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
