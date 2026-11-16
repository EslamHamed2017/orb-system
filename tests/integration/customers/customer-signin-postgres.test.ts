import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const uuid7 = () => { const value = randomUUID(); return `${value.slice(0, 14)}7${value.slice(15)}`; };
const userId = "019a5f9b-7c00-7000-8000-000000000311";

integration("real sign-in persists the exact secure cookie hash used by customer authentication", async () => {
  // @ts-expect-error pg is a runtime dependency; optional declarations are not needed.
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl }); await sql.connect();
  const tenantId = uuid7();
  try {
    await sql.query('INSERT INTO "Tenant" (id,slug,name) VALUES ($1,$2,$3)', [tenantId, `signin-${tenantId}`, "Sign-in integration"]);
    await sql.query('INSERT INTO "User" (id,auth_subject,name_ar,name_en,locale,status,mfa_state,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now()) ON CONFLICT (id) DO NOTHING', [userId, "signin-operations", "عمليات", "Operations", "en", "ACTIVE", "SATISFIED"]);
    await sql.query('INSERT INTO "UserRole" (id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT (user_id,role) DO NOTHING', [uuid7(), userId, "OPERATIONS"]);
    await sql.query('INSERT INTO "TenantMembership" (id,tenant_id,user_id,status) VALUES ($1,$2,$3,$4)', [uuid7(), tenantId, userId, "ACTIVE"]);
    process.env.DATABASE_URL = databaseUrl; process.env.ORB_TEST_AUTH = "1"; process.env.ORB_APP_ORIGIN = "http://127.0.0.1:3999";
    const { POST } = await import("../../../src/app/api/sessions/route.ts");
    const response = await POST(new Request("http://127.0.0.1:3999/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: "operations@example.test", credential: "test-credential" }) }) as never);
    assert.equal(response.status, 201);
    const setCookie = response.headers.get("set-cookie") ?? "";
    const token = /__Host-orb_session=([^;]+)/.exec(setCookie)?.[1];
    assert.ok(token);
    const csrfCookie = /__Host-orb_csrf=([^;]+)/.exec(setCookie)?.[1];
    assert.equal(decodeURIComponent(csrfCookie ?? ""), createHash("sha256").update(`orb-customer-csrf\0${decodeURIComponent(token)}`).digest("hex"));
    const persisted = await sql.query('SELECT token_hash, expires_at, revoked_at FROM "Session" WHERE user_id=$1 ORDER BY expires_at DESC LIMIT 1', [userId]);
    assert.equal(persisted.rows[0].token_hash, createHash("sha256").update(decodeURIComponent(token)).digest("hex"));
    assert.equal(persisted.rows[0].revoked_at, null);
  } finally {
    await sql.query('DELETE FROM "Session" WHERE user_id=$1', [userId]);
    await sql.query('DELETE FROM "TenantMembership" WHERE user_id=$1', [userId]);
    await sql.query('DELETE FROM "UserRole" WHERE user_id=$1', [userId]);
    await sql.query('DELETE FROM "User" WHERE id=$1', [userId]);
    await sql.query('DELETE FROM "Tenant" WHERE id=$1', [tenantId]);
    await sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts"); await getPrismaClient().$disconnect();
  }
});
