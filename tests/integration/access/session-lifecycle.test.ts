import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const USER_ID = "019a5f9b-7c00-7000-8000-000000000301";
const OWNER_ID = "019a5f9b-7c00-7000-8000-000000000302";
const SESSION_ID = "019a5f9b-7c00-7000-8000-000000000303";
const CREATED_AT = "2026-11-06T10:00:00.000Z";
interface SessionService {
  createPilotSession(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  validatePilotSession(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  rotateSessionSecrets(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  revokePilotSession(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  listPilotUserSessions(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}
async function loadSessions(): Promise<SessionService> {
  return import("../../../src/modules/access/session-service.ts") as Promise<SessionService>;
}
function memoryRepository() {
  const sessions = new Map<string, Record<string, unknown>>();
  return {
    sessions,
    insertSession: async (record: Record<string, unknown>) => { sessions.set(record.sessionId as string, structuredClone(record)); },
    findSession: async (id: string) => sessions.get(id) ? structuredClone(sessions.get(id)) : null,
    updateSession: async (id: string, expectedVersion: number, changes: Record<string, unknown>) => {
      const current = sessions.get(id);
      if (!current || current.version !== expectedVersion) throw new Error("STALE_VERSION");
      const updated = { ...current, ...structuredClone(changes), version: expectedVersion + 1 };
      sessions.set(id, updated); return structuredClone(updated);
    },
    listUserSessions: async (userId: string) => [...sessions.values()].filter((row) => row.userId === userId).map(structuredClone),
  };
}

test("sign-in creates 30-minute idle and 12-hour absolute expiry with separate rotated secrets", async () => {
  const service = await loadSessions(), repository = memoryRepository();
  const result = await service.createPilotSession({
    sessionId: SESSION_ID, userId: USER_ID, roles: ["OPERATIONS"], now: CREATED_AT, repository,
    generateSessionToken: () => "session-secret-1", generateCsrfToken: () => "csrf-secret-1",
  });
  assert.deepEqual(result, {
    session: {
      sessionId: SESSION_ID, userId: USER_ID, roles: ["OPERATIONS"], createdAt: CREATED_AT, lastSeenAt: CREATED_AT,
      idleExpiresAt: "2026-11-06T10:30:00.000Z", absoluteExpiresAt: "2026-11-06T22:00:00.000Z", mfaRequired: false, version: 1,
    },
    sessionToken: "session-secret-1", csrfToken: "csrf-secret-1",
    cookie: { name: "__Host-orb_session", secure: true, httpOnly: true, sameSite: "Strict", path: "/", domain: null },
  });
  assert.notEqual(result.sessionToken, result.csrfToken);
});

test("validation extends only idle expiry and rejects idle, absolute, and revoked sessions immediately", async () => {
  const service = await loadSessions(), repository = memoryRepository();
  repository.sessions.set(SESSION_ID, {
    sessionId: SESSION_ID, userId: USER_ID, roles: ["FINANCE_VIEWER"], createdAt: CREATED_AT, lastSeenAt: CREATED_AT,
    idleExpiresAt: "2026-11-06T10:30:00.000Z", absoluteExpiresAt: "2026-11-06T22:00:00.000Z",
    revoked: false, revokedAt: null, revokedBy: null, revocationReason: null, version: 1,
  });
  const active = await service.validatePilotSession({ sessionId: SESSION_ID, now: "2026-11-06T10:20:00.000Z", repository });
  assert.equal(active.lastSeenAt, "2026-11-06T10:20:00.000Z");
  assert.equal(active.idleExpiresAt, "2026-11-06T10:50:00.000Z");
  assert.equal(active.absoluteExpiresAt, "2026-11-06T22:00:00.000Z");

  for (const row of [
    { idleExpiresAt: "2026-11-06T10:19:59.000Z" },
    { absoluteExpiresAt: "2026-11-06T10:19:59.000Z" },
    { revoked: true, revokedAt: "2026-11-06T10:10:00.000Z", revokedBy: { id: OWNER_ID }, revocationReason: "ADMIN_REVOKE" },
  ]) {
    repository.sessions.set(SESSION_ID, { ...repository.sessions.get(SESSION_ID), ...row });
    await assert.rejects(service.validatePilotSession({ sessionId: SESSION_ID, now: "2026-11-06T10:20:00.000Z", repository }), (error: unknown) => error instanceof ProblemError && error.problem.code === "AUTHENTICATION_REQUIRED");
  }
});

test("reauthentication and privilege change rotate both session and CSRF tokens", async () => {
  const service = await loadSessions();
  for (const reason of ["REAUTHENTICATION", "PRIVILEGE_CHANGE"]) {
    let counter = 0;
    const rotated = await service.rotateSessionSecrets({
      sessionId: SESSION_ID, reason, currentSessionToken: "old-session", currentCsrfToken: "old-csrf",
      generateSecret: () => `${reason.toLowerCase()}-${++counter}`,
    });
    assert.notEqual(rotated.sessionToken, "old-session");
    assert.notEqual(rotated.csrfToken, "old-csrf");
    assert.notEqual(rotated.sessionToken, rotated.csrfToken);
  }
});

test("exact-session revoke persists actor/time/reason and invalidates the next request", async () => {
  const service = await loadSessions(), repository = memoryRepository();
  repository.sessions.set(SESSION_ID, {
    sessionId: SESSION_ID, userId: USER_ID, roles: ["OPERATIONS"], current: false, createdAt: CREATED_AT, lastSeenAt: CREATED_AT,
    idleExpiresAt: "2026-11-06T10:30:00.000Z", absoluteExpiresAt: "2026-11-06T22:00:00.000Z",
    revoked: false, revokedAt: null, revokedBy: null, revocationReason: null, version: 1,
  });
  const revoked = await service.revokePilotSession({
    userId: USER_ID, sessionId: SESSION_ID, expectedVersion: 1, actor: { userId: OWNER_ID, displayName: "Owner", roles: ["OWNER_ADMIN"] },
    now: "2026-11-06T10:15:00.000Z", reason: "SECURITY_REVIEW", repository,
  });
  assert.equal(revoked.revoked, true);
  assert.equal(revoked.revokedAt, "2026-11-06T10:15:00.000Z");
  assert.deepEqual(revoked.revokedBy, { userId: OWNER_ID, displayName: "Owner", roles: ["OWNER_ADMIN"] });
  assert.equal(revoked.revocationReason, "SECURITY_REVIEW");
  await assert.rejects(service.validatePilotSession({ sessionId: SESSION_ID, now: "2026-11-06T10:16:00.000Z", repository }), /authentication|revoked|session/i);
  const page = await service.listPilotUserSessions({ userId: USER_ID, repository });
  assert.deepEqual(page, { userId: USER_ID, items: [revoked] });
});
