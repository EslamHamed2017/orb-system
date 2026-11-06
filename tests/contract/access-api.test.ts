import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const OPENAPI = readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8");
function section(start: string, end: string): string {
  const from = OPENAPI.indexOf(start), to = OPENAPI.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing contract section ${start}`);
  return OPENAPI.slice(from, to);
}

test("access routes retain public sign-in, authenticated sign-out and Owner-only administration", () => {
  const signIn = section("  /sessions:\n", "  /sessions/current:\n");
  assert.match(signIn, /operationId: signIn[\s\S]*security: \[\][\s\S]*x-required-roles: \[\]/);
  assert.match(signIn, /Set-Cookie:[\s\S]*__Host-orb_session with Secure; HttpOnly; SameSite=Strict; Path=\/ and no Domain/);
  assert.match(signIn, /X-CSRF-Token:[\s\S]*Session-bound CSRF token/);

  const signOut = section("  /sessions/current:\n", "  /users:\n");
  assert.match(signOut, /operationId: signOutCurrentSession/);
  for (const role of ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]) assert.match(signOut, new RegExp(`      - ${role}\\n`));
  for (const control of ["IfMatch", "IdempotencyKey", "CsrfToken"]) assert.match(signOut, new RegExp(`parameters/${control}`));

  const administration = section("  /users:\n", "  /recovery/backup-status:\n");
  for (const operationId of ["listPilotUsers", "assignFixedPilotRoles", "revokePilotUserSession"]) {
    const from = administration.indexOf(`operationId: ${operationId}`);
    assert.ok(from >= 0, operationId);
    assert.match(administration.slice(from, administration.indexOf("summary:", from)), /x-required-roles:\n      - OWNER_ADMIN\n/);
  }
  const sessions = section("  /users/{userId}/sessions:\n", "components:\n");
  assert.match(sessions, /operationId: listPilotUserSessions[\s\S]*x-required-roles:\n      - OWNER_ADMIN\n/);
});

test("cookie, CSRF, source-validation and expiry policy is exact and fail closed", () => {
  const policy = OPENAPI.slice(OPENAPI.indexOf("x-cookie-auth-policy:\n"));
  for (const assertion of [
    /name: __Host-orb_session/, /secure: true/, /httpOnly: true/, /sameSite: Strict/, /path: \//,
    /domainAttributeAllowed: false/, /header: X-CSRF-Token/,
    /requiredFor: all cookie-authenticated POST, PUT, PATCH and DELETE operations/,
    /binding: session and authenticated origin/, /- SIGN_IN/, /- REAUTHENTICATION/, /- PRIVILEGE_CHANGE/,
    /originRequired: true/, /refererRequiredWhenOriginUnavailable: true/, /failureMode: fail closed before mutation/,
    /idleExpiryMinutes: 30/, /absoluteExpiryHours: 12/, /revokeInvalidatesImmediately: true/,
  ]) assert.match(policy, assertion);
});

test("session and role schemas are closed, fixed and expose exact lifecycle metadata", () => {
  const session = section("    Session:\n", "    RoleAssignmentInput:\n");
  assert.match(session, /additionalProperties: false/);
  for (const key of ["sessionId", "userId", "roles", "createdAt", "lastSeenAt", "idleExpiresAt", "absoluteExpiresAt", "version"]) assert.match(session, new RegExp(`      - ${key}\\n`));
  for (const role of ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]) assert.match(session, new RegExp(`            - ${role}\\n`));

  const assignment = section("    RoleAssignmentInput:\n", "    BackupStatus:\n");
  assert.match(assignment, /additionalProperties: false[\s\S]*minItems: 1[\s\S]*uniqueItems: true/);
  const userSession = section("    UserSession:\n", "    UserSessionPage:\n");
  for (const key of ["current", "lastSeenAt", "idleExpiresAt", "absoluteExpiresAt", "revoked", "revokedAt", "revokedBy", "revocationReason", "version"]) assert.match(userSession, new RegExp(`      - ${key}\\n`));
  assert.match(userSession, /const: true[\s\S]*then:[\s\S]*revokedAt:[\s\S]*type: string[\s\S]*revokedBy:[\s\S]*ActorSnapshot[\s\S]*revocationReason:[\s\S]*minLength: 1/);
  assert.match(userSession, /const: false[\s\S]*then:[\s\S]*revokedAt:[\s\S]*const: null[\s\S]*revokedBy:[\s\S]*const: null[\s\S]*revocationReason:[\s\S]*const: null/);
});
