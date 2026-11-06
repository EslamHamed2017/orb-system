// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "../../platform/http/problem.ts";
import type { PilotRole } from "./roles.ts";

export interface SessionRecord {
  sessionId: string; userId: string; roles: readonly PilotRole[]; current?: boolean;
  createdAt: string; lastSeenAt: string; idleExpiresAt: string; absoluteExpiresAt: string;
  revoked: boolean; revokedAt: string | null; revokedBy: ActorSnapshot | null; revocationReason: string | null;
  version: number; [key: string]: unknown;
}
export interface ActorSnapshot { userId: string; displayName: string; roles: readonly PilotRole[] }
export interface SessionRepository {
  insertSession(record: Record<string, unknown>): Promise<void>;
  findSession(id: string): Promise<Record<string, unknown> | null>;
  updateSession(id: string, expectedVersion: number, changes: Record<string, unknown>): Promise<Record<string, unknown>>;
  listUserSessions(userId: string): Promise<Record<string, unknown>[]>;
}
const IDLE_MS = 30 * 60_000, ABSOLUTE_MS = 12 * 60 * 60_000;
const isoAfter = (value: string, milliseconds: number) => new Date(Date.parse(value) + milliseconds).toISOString();
const authFailure = () => problemError({ code: "AUTHENTICATION_REQUIRED", status: 401, detail: "Authentication session is missing, expired, or revoked.", correlationId: crypto.randomUUID() });

export async function createPilotSession(input: {
  sessionId: string; userId: string; roles: readonly PilotRole[]; now: string; repository: SessionRepository;
  generateSessionToken: () => string; generateCsrfToken: () => string;
}) {
  const sessionToken = input.generateSessionToken(), csrfToken = input.generateCsrfToken();
  if (!sessionToken || !csrfToken || sessionToken === csrfToken) throw new Error("Session and CSRF secrets must be distinct");
  const stored: SessionRecord = {
    sessionId: input.sessionId, userId: input.userId, roles: [...input.roles], createdAt: input.now, lastSeenAt: input.now,
    idleExpiresAt: isoAfter(input.now, IDLE_MS), absoluteExpiresAt: isoAfter(input.now, ABSOLUTE_MS),
    revoked: false, revokedAt: null, revokedBy: null, revocationReason: null, version: 1,
  };
  await input.repository.insertSession(stored);
  const { revoked: _revoked, revokedAt: _revokedAt, revokedBy: _revokedBy, revocationReason: _reason, ...publicSession } = stored;
  return { session: { ...publicSession, mfaRequired: input.roles.includes("OWNER_ADMIN") }, sessionToken, csrfToken,
    cookie: { name: "__Host-orb_session", secure: true, httpOnly: true, sameSite: "Strict", path: "/", domain: null } as const };
}

export async function validatePilotSession(input: { sessionId: string; now: string; repository: SessionRepository }) {
  const found = await input.repository.findSession(input.sessionId) as SessionRecord | null;
  const now = Date.parse(input.now);
  if (!found || !Number.isFinite(now) || found.revoked || now >= Date.parse(found.idleExpiresAt) || now >= Date.parse(found.absoluteExpiresAt)) throw authFailure();
  return input.repository.updateSession(found.sessionId, found.version, { lastSeenAt: input.now, idleExpiresAt: isoAfter(input.now, IDLE_MS) });
}

export async function rotateSessionSecrets(input: {
  sessionId: string; reason: "SIGN_IN" | "REAUTHENTICATION" | "PRIVILEGE_CHANGE";
  currentSessionToken: string; currentCsrfToken: string; generateSecret: () => string;
}) {
  let sessionToken = input.generateSecret(), csrfToken = input.generateSecret();
  if (!sessionToken || !csrfToken || sessionToken === csrfToken || sessionToken === input.currentSessionToken || csrfToken === input.currentCsrfToken) {
    throw new Error("Secret rotation did not produce distinct fresh values");
  }
  return { sessionId: input.sessionId, reason: input.reason, sessionToken, csrfToken };
}

export async function revokePilotSession(input: {
  userId: string; sessionId: string; expectedVersion: number; actor: ActorSnapshot; now: string; reason: string; repository: SessionRepository;
}) {
  const found = await input.repository.findSession(input.sessionId) as SessionRecord | null;
  if (!found || found.userId !== input.userId) throw authFailure();
  if (!input.reason.trim()) throw new Error("Revocation reason is required");
  return input.repository.updateSession(input.sessionId, input.expectedVersion, {
    revoked: true, revokedAt: input.now, revokedBy: structuredClone(input.actor), revocationReason: input.reason,
  });
}

export async function listPilotUserSessions(input: { userId: string; repository: SessionRepository }) {
  return { userId: input.userId, items: await input.repository.listUserSessions(input.userId) };
}
