import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

/**
 * End-to-end access flow on a real PostgreSQL database:
 * owner sign-in → user administration → lockout → password change → role change → sign-out.
 * Requires ORB_TEST_DATABASE_URL with all migrations applied.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const ORIGIN = "http://127.0.0.1:3999";

function cookiesFrom(response: Response): string {
  const raw = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  return raw.map((cookie) => cookie.split(";")[0]).filter((pair) => !pair.endsWith("=")).join("; ");
}
function csrfOf(cookies: string): string {
  return decodeURIComponent(/__Host-orb_csrf=([^;]+)/.exec(cookies)?.[1] ?? "");
}
function call(url: string, init: { method?: string; cookies?: string; body?: unknown; csrf?: boolean; origin?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookies) headers.cookie = init.cookies;
  if (init.csrf !== false && init.cookies) headers["x-csrf-token"] = csrfOf(init.cookies);
  if (init.method && init.method !== "GET") headers.origin = init.origin ?? ORIGIN;
  return new Request(`${ORIGIN}${url}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
const params = <T>(value: T) => ({ params: Promise.resolve(value) });
// Test-only passwords generated per run (never committed literals).
const generated = () => `Tst${randomBytes(8).toString("hex")}9`;
const OWNER_PW = generated(), WRONG_PW = generated(), TEMP_PW = generated(), NEXT_PW = generated(), OUTSIDER_PW = generated();

integration("owner signs in, administers users, and the server enforces every access rule", async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.ORB_APP_ORIGIN = ORIGIN;
  process.env.ORB_ALLOWED_ORIGINS = ORIGIN;
  process.env.ORB_OWNER_MFA_REQUIRED = "0";
  delete process.env.ORB_TEST_AUTH;

  const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
  const { PrismaAccessStore } = await import("../../../src/modules/access/access-store.ts");
  const { hashPassword } = await import("../../../src/modules/access/password.ts");
  const prisma = getPrismaClient();
  const suffix = Date.now().toString(36);
  const tenant = await prisma.tenant.create({ data: { slug: `access-${suffix}`, name: "Access integration" } });
  const store = new PrismaAccessStore(prisma);
  const ownerLogin = `owner-${suffix}@orb.test`, userLogin = `ops-${suffix}@orb.test`;
  const ownerId = await store.createUser({
    tenantId: tenant.id, actorId: null, login: ownerLogin, nameEn: "Owner", nameAr: "المالك", locale: "ar",
    roleCodes: ["OWNER_ADMIN"], passwordHash: await hashPassword(OWNER_PW), mustChangePassword: false, now: new Date(),
  });

  const sessions = await import("../../../src/app/api/sessions/route.ts");
  const current = await import("../../../src/app/api/sessions/current/route.ts");
  const ownPassword = await import("../../../src/app/api/sessions/current/password/route.ts");
  const users = await import("../../../src/app/api/users/route.ts");
  const user = await import("../../../src/app/api/users/[userId]/route.ts");
  const roles = await import("../../../src/app/api/users/[userId]/roles/route.ts");
  const userSessions = await import("../../../src/app/api/users/[userId]/sessions/route.ts");
  const projects = await import("../../../src/app/api/projects/route.ts");

  const signIn = async (login: string, credential: string) => sessions.POST(call("/api/sessions", { method: "POST", body: { login, credential } }) as never);

  // 1. Wrong password and unknown login fail identically.
  assert.equal((await signIn(ownerLogin, WRONG_PW)).status, 401);
  assert.equal((await signIn(`nobody-${suffix}@orb.test`, WRONG_PW)).status, 401);

  // 2. Owner signs in with a real database credential (login is case-insensitive).
  const ownerResponse = await signIn(ownerLogin.toUpperCase(), OWNER_PW);
  assert.equal(ownerResponse.status, 201);
  assert.equal((await ownerResponse.json()).mfaRequired, false);
  const owner = cookiesFrom(ownerResponse);

  const me = await current.GET(call("/api/sessions/current", { cookies: owner }));
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.deepEqual(meBody.roles, ["OWNER_ADMIN"]);
  assert.equal(meBody.nameAr, "المالك");
  assert.equal(meBody.tenantId, undefined, "tenant id is not exposed to the browser");

  // 3. The same session works on the already-wired business APIs.
  assert.equal((await projects.GET(call("/api/projects", { cookies: owner }))).status, 200);

  // 4. Mutations without CSRF or from another origin are refused.
  const newUser = { login: userLogin, nameEn: "Ops User", nameAr: "مستخدم العمليات", locale: "ar", roleCodes: ["OPERATIONS"], password: TEMP_PW };
  assert.equal((await users.POST(call("/api/users", { method: "POST", cookies: owner, body: newUser, csrf: false }))).status, 403);
  assert.equal((await users.POST(call("/api/users", { method: "POST", cookies: owner, body: newUser, origin: "https://evil.example" }))).status, 403);

  // 5. Validation errors come back as 422 problems.
  const weak = await users.POST(call("/api/users", { method: "POST", cookies: owner, body: { ...newUser, password: "weak" } }));
  assert.equal(weak.status, 422);
  assert.match((await weak.json()).detail, /at least 10/);

  // 6. Owner creates a user; duplicate login is a conflict.
  const created = await users.POST(call("/api/users", { method: "POST", cookies: owner, body: newUser }));
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.login, userLogin);
  assert.deepEqual(createdBody.roleCodes, ["OPERATIONS"]);
  assert.equal(createdBody.mustChangePassword, true);
  assert.equal((await users.POST(call("/api/users", { method: "POST", cookies: owner, body: newUser }))).status, 409);
  const listed = await (await users.GET(call("/api/users", { cookies: owner }))).json();
  assert.deepEqual(listed.items.map((item: { login: string }) => item.login).sort(), [ownerLogin, userLogin].sort());

  // 7. The new user signs in, must change password, and cannot manage users.
  const opsResponse = await signIn(userLogin, TEMP_PW);
  assert.equal(opsResponse.status, 201);
  let ops = cookiesFrom(opsResponse);
  assert.equal((await (await current.GET(call("/api/sessions/current", { cookies: ops }))).json()).mustChangePassword, true);
  assert.equal((await users.GET(call("/api/users", { cookies: ops }))).status, 403);
  assert.equal((await ownPassword.POST(call("/api/sessions/current/password", { method: "POST", cookies: ops, body: { currentPassword: "nope", newPassword: NEXT_PW } }), params({}))).status, 422);
  assert.equal((await ownPassword.POST(call("/api/sessions/current/password", { method: "POST", cookies: ops, body: { currentPassword: TEMP_PW, newPassword: NEXT_PW } }), params({}))).status, 204);
  assert.equal((await (await current.GET(call("/api/sessions/current", { cookies: ops }))).json()).mustChangePassword, false);
  assert.equal((await signIn(userLogin, TEMP_PW)).status, 401, "old password no longer works");

  // 8. A role change revokes the user's sessions.
  const replaced = await roles.PUT(call(`/api/users/${createdBody.id}/roles`, { method: "PUT", cookies: owner, body: { roleCodes: ["FINANCE_VIEWER", "OPERATIONS"] } }), params({ userId: createdBody.id }));
  assert.equal(replaced.status, 200);
  assert.deepEqual((await replaced.json()).roleCodes, ["FINANCE_VIEWER", "OPERATIONS"]);
  assert.equal((await current.GET(call("/api/sessions/current", { cookies: ops }))).status, 401);
  ops = cookiesFrom(await signIn(userLogin, NEXT_PW));
  const opsSessions = await (await userSessions.GET(call(`/api/users/${createdBody.id}/sessions`, { cookies: owner }) as never, params({ userId: createdBody.id }))).json();
  assert.equal(opsSessions.items.filter((item: { active: boolean }) => item.active).length, 1);

  // 9. The last owner cannot be suspended or demoted, and you cannot suspend yourself.
  const demote = await roles.PUT(call(`/api/users/${ownerId}/roles`, { method: "PUT", cookies: owner, body: { roleCodes: ["OPERATIONS"] } }), params({ userId: ownerId }));
  assert.equal(demote.status, 409);
  assert.equal((await demote.json()).code, "LAST_OWNER");
  assert.equal((await user.PATCH(call(`/api/users/${ownerId}`, { method: "PATCH", cookies: owner, body: { status: "SUSPENDED" } }), params({ userId: ownerId }))).status, 422);

  // 10. Suspending a user ends their sessions and blocks sign-in.
  const suspended = await user.PATCH(call(`/api/users/${createdBody.id}`, { method: "PATCH", cookies: owner, body: { status: "SUSPENDED" } }), params({ userId: createdBody.id }));
  assert.equal((await suspended.json()).status, "SUSPENDED");
  assert.equal((await current.GET(call("/api/sessions/current", { cookies: ops }))).status, 401);
  assert.equal((await signIn(userLogin, NEXT_PW)).status, 401);

  // 11. Five wrong passwords lock the account, even for the right password afterwards.
  await user.PATCH(call(`/api/users/${createdBody.id}`, { method: "PATCH", cookies: owner, body: { status: "ACTIVE" } }), params({ userId: createdBody.id }));
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await signIn(userLogin, WRONG_PW)).status, 401);
  assert.equal((await signIn(userLogin, NEXT_PW)).status, 401, "locked account refuses the correct password");

  // 12. Users in another tenant are invisible.
  const otherTenant = await prisma.tenant.create({ data: { slug: `other-${suffix}`, name: "Other" } });
  const outsiderId = await store.createUser({
    tenantId: otherTenant.id, actorId: null, login: `outsider-${suffix}@orb.test`, nameEn: "Outsider", nameAr: "خارجي", locale: "en",
    roleCodes: ["OPERATIONS"], passwordHash: await hashPassword(OUTSIDER_PW), mustChangePassword: false, now: new Date(),
  });
  assert.equal((await user.PATCH(call(`/api/users/${outsiderId}`, { method: "PATCH", cookies: owner, body: { nameEn: "Hijacked" } }), params({ userId: outsiderId }))).status, 404);

  // 13. Sign-out revokes the session server-side.
  assert.equal((await current.DELETE(call("/api/sessions/current", { method: "DELETE", cookies: owner }))).status, 204);
  assert.equal((await current.GET(call("/api/sessions/current", { cookies: owner }))).status, 401);

  // Every administrative action left an audit trail.
  const actions = (await prisma.accessAuditEvent.findMany({ where: { tenant_id: tenant.id }, orderBy: { occurred_at: "asc" } })).map((event) => event.action);
  for (const action of ["USER_CREATED", "SIGN_IN_SUCCEEDED", "PASSWORD_CHANGED", "ROLES_REPLACED", "USER_SUSPENDED", "USER_REACTIVATED", "SIGN_IN_LOCKED", "SIGNED_OUT"]) {
    assert.ok(actions.includes(action), `missing audit action ${action}`);
  }
  await prisma.$disconnect();
});
