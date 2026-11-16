import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaCustomerSessionContextRepository } from "../../../src/modules/tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { customerCsrfToken, validateCustomerMutationRequest } from "../../../src/modules/customers/customer-mutation-security.ts";

test("Prisma session context resolves only a current active user, membership, and role set", async () => {
  const calls: unknown[][] = [];
  const row = {
    session_id: "44444444-4444-4444-8444-444444444444",
    user_id: "33333333-3333-4333-8333-333333333333",
    tenant_id: "11111111-1111-4111-8111-111111111111",
    locale: "en",
    roles: ["OPERATIONS"],
  };
  const repository = new PrismaCustomerSessionContextRepository({
    async $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      calls.push([strings, ...values]);
      return [row] as T;
    },
  });
  const now = new Date("2026-11-16T12:00:00.000Z");
  assert.deepEqual(await repository.findActiveContext("a".repeat(64), now), {
    sessionId: row.session_id, userId: row.user_id, tenantId: row.tenant_id, locale: "en", roles: ["OPERATIONS"],
  });
  const [strings, hash, receivedNow] = calls[0] as [TemplateStringsArray, string, Date];
  const sql = strings.join("?");
  assert.equal(hash, "a".repeat(64));
  assert.equal(receivedNow, now);
  assert.match(sql, /FROM "Session"/);
  assert.match(sql, /"expires_at" > /);
  assert.match(sql, /"revoked_at" IS NULL/);
  assert.match(sql, /u\."status" = 'ACTIVE'/);
  assert.match(sql, /tm\."status" = 'ACTIVE'/);
  assert.match(sql, /"UserRole"/);
});

test("production customer routes are runtime-composed and navigation exposes Customers before Suppliers", () => {
  const collection = readFileSync("src/app/api/customers/route.ts", "utf8");
  const record = readFileSync("src/app/api/customers/[customerId]/route.ts", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.doesNotMatch(collection + record, /const unavailable/);
  for (const seam of ["customerRuntime", "service.list", "customerRuntime().create", "service.get", "customerRuntime().update"])
    assert.ok((collection + record).includes(seam), `missing production seam ${seam}`);
  const railCustomers = navigation.indexOf('label={label("Customers", "العملاء")}');
  const railSuppliers = navigation.indexOf('label={label("Suppliers", "الموردون")}');
  assert.ok(railCustomers >= 0 && railCustomers < railSuppliers);
  const dialogCustomers = navigation.indexOf('{label("Customers", "العملاء")}</a>');
  const dialogSuppliers = navigation.indexOf('{label("Suppliers", "الموردون")}</a>');
  assert.ok(dialogCustomers >= 0 && dialogCustomers < dialogSuppliers);
});


test("session context rejects ambiguous active tenant memberships", async () => {
  const row = { mfa_satisfied_at: null, session_id: "44444444-4444-4444-8444-444444444444", user_id: "33333333-3333-4333-8333-333333333333", tenant_id: "11111111-1111-4111-8111-111111111111", locale: "en", roles: ["OPERATIONS"] };
  const repository = new PrismaCustomerSessionContextRepository({ async $queryRaw<T>(): Promise<T> { return [row, { ...row, tenant_id: "22222222-2222-4222-8222-222222222222" }] as T; } });
  assert.equal(await repository.findActiveContext("a".repeat(64), new Date()), null);
});

test("customer mutations require allow-listed origin, session-bound CSRF, and UUID idempotency", () => {
  process.env.ORB_APP_ORIGIN = "https://orb.example";
  const sessionToken = "session-secret", csrf = customerCsrfToken(sessionToken);
  const valid = new Request("https://orb.example/api/customers", { method: "POST", headers: { origin: "https://orb.example", cookie: `__Host-orb_session=${sessionToken}; __Host-orb_csrf=${csrf}`, "x-csrf-token": csrf, "idempotency-key": "11111111-1111-7111-8111-111111111111" } });
  assert.equal(validateCustomerMutationRequest(valid), "11111111-1111-7111-8111-111111111111");
  for (const headers of [
    { origin: "https://evil.example", cookie: `__Host-orb_session=${sessionToken}; __Host-orb_csrf=${csrf}`, "x-csrf-token": csrf, "idempotency-key": "11111111-1111-7111-8111-111111111111" },
    { origin: "https://orb.example", cookie: `__Host-orb_session=${sessionToken}; __Host-orb_csrf=${csrf}`, "x-csrf-token": "wrong", "idempotency-key": "11111111-1111-7111-8111-111111111111" },
    { origin: "https://orb.example", cookie: `__Host-orb_session=${sessionToken}; __Host-orb_csrf=${csrf}`, "x-csrf-token": csrf, "idempotency-key": "not-a-uuid" },
  ]) assert.throws(() => validateCustomerMutationRequest(new Request("https://orb.example/api/customers", { method: "POST", headers })));
});


test("customer session context rejects Owner access until MFA is satisfied", async () => {
  const owner = { session_id: "44444444-4444-4444-8444-444444444444", user_id: "33333333-3333-4333-8333-333333333333", tenant_id: "11111111-1111-4111-8111-111111111111", locale: "en", roles: ["OWNER_ADMIN"], mfa_satisfied_at: null };
  const repository = new PrismaCustomerSessionContextRepository({ async $queryRaw<T>(): Promise<T> { return [owner] as T; } });
  assert.equal(await repository.findActiveContext("a".repeat(64), new Date()), null);
  const satisfied = new PrismaCustomerSessionContextRepository({ async $queryRaw<T>(): Promise<T> { return [{ ...owner, mfa_satisfied_at: new Date() }] as T; } });
  assert.deepEqual((await satisfied.findActiveContext("a".repeat(64), new Date()))?.roles, ["OWNER_ADMIN"]);
});
