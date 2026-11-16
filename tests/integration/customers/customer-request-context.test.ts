import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createCustomerRequestAuthenticator, hashSessionToken } from "../../../src/modules/tenancy/customer-request-context.ts";

const token = "test-session-token-with-enough-entropy";
const active = {
  sessionId: "44444444-4444-4444-8444-444444444444",
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roles: ["OPERATIONS"],
  locale: "en",
};

test("customer request context hashes the cookie before using repository-resolved tenant and actor", async () => {
  let receivedHash = "";
  const authenticate = createCustomerRequestAuthenticator({
    now: () => new Date("2026-11-16T12:00:00.000Z"),
    findActiveContext: async (tokenHash, now) => { receivedHash = tokenHash; assert.equal(now.toISOString(), "2026-11-16T12:00:00.000Z"); return active; },
  });
  const principal = await authenticate(new Request("https://orb.example/api/customers", { headers: { cookie: `other=x; __Host-orb_session=${token}` } }));
  assert.equal(receivedHash, hashSessionToken(token));
  assert.notEqual(receivedHash, token);
  assert.deepEqual(principal, { tenantId: active.tenantId, userId: active.userId, roles: active.roles });
});

test("customer request context fails closed when the cookie is missing or malformed or the repository rejects the session", async () => {
  let calls = 0;
  const authenticate = createCustomerRequestAuthenticator({ findActiveContext: async () => { calls += 1; return null; } });
  assert.equal(await authenticate(new Request("https://orb.example/api/customers")), null);
  assert.equal(await authenticate(new Request("https://orb.example/api/customers", { headers: { cookie: "__Host-orb_session=%" } })), null);
  assert.equal(await authenticate(new Request("https://orb.example/api/customers", { headers: { cookie: `__Host-orb_session=${token}` } })), null);
  assert.equal(calls, 1);
});


test("schema persists hashed sessions and one active tenant membership per user", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/202611160001_tenant_session_context/migration.sql", "utf8");
  assert.match(schema, /model TenantMembership \{[\s\S]*tenant_id[\s\S]*user_id[\s\S]*status/);
  assert.match(schema, /model Session \{[\s\S]*token_hash/);
  assert.match(migration, /UNIQUE \(\"token_hash\"\)/);
  assert.match(migration, /TenantMembership_one_active_tenant_per_user/);
  assert.doesNotMatch(migration, /INSERT INTO/);
});
