// @ts-expect-error Native Node TypeScript tests require source extensions.
import { hashPassword, passwordPolicyViolation, verifyAgainstDummy, verifyPassword } from "./password.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PILOT_ROLES, type PilotRole } from "./roles.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { AccessStoreError, type AdminUserRecord, type PrismaAccessStore, type UserStatus } from "./access-store.ts";

export type AccessStore = Pick<PrismaAccessStore, keyof PrismaAccessStore>;

export interface AccessActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

export type AccessProblemCode =
  | "AUTHENTICATION_REQUIRED" | "PERMISSION_DENIED" | "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT" | "LAST_OWNER";

export class AccessProblem extends Error {
  readonly status: number;
  readonly code: AccessProblemCode;
  readonly detail: string;
  constructor(status: number, code: AccessProblemCode, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const invalid = (detail: string) => new AccessProblem(422, "VALIDATION_FAILED", detail);
const ROLE_SET = new Set<string>(PILOT_ROLES);

export function normalizeLogin(value: unknown): string {
  if (typeof value !== "string") throw invalid("Login is required.");
  const login = value.trim().toLowerCase();
  if (login.length < 3 || login.length > 254 || !/^[a-z0-9._%+@-]+$/.test(login)) {
    throw invalid("Login must be 3-254 characters: letters, digits, and . _ % + @ -");
  }
  return login;
}

function name(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160) throw invalid(`${field} is required (max 160 characters).`);
  return value.trim();
}

function locale(value: unknown): "en" | "ar" {
  if (value !== "en" && value !== "ar") throw invalid("Locale must be en or ar.");
  return value;
}

function roleCodes(value: unknown): PilotRole[] {
  if (!Array.isArray(value) || value.length === 0) throw invalid("At least one role is required.");
  const unique = [...new Set(value)];
  if (unique.length !== value.length || !unique.every((role) => typeof role === "string" && ROLE_SET.has(role))) {
    throw invalid(`Roles must be unique values from: ${PILOT_ROLES.join(", ")}.`);
  }
  return (unique as PilotRole[]).sort();
}

function password(value: unknown): string {
  const violation = passwordPolicyViolation(value);
  if (violation) throw invalid(violation);
  return value as string;
}

function requireOwner(actor: AccessActor) {
  if (!actor.roles.includes("OWNER_ADMIN")) throw new AccessProblem(403, "PERMISSION_DENIED", "Only an owner administrator can manage users.");
}

function translate(error: unknown): never {
  if (error instanceof AccessStoreError) {
    if (error.code === "NOT_FOUND") throw new AccessProblem(404, "NOT_FOUND", error.message);
    throw new AccessProblem(409, "CONFLICT", error.message);
  }
  throw error;
}

export function createAccessService(store: AccessStore, clock: () => Date = () => new Date()) {
  async function guardLastOwner(actor: AccessActor, userId: string, losesOwnerAccess: boolean) {
    if (!losesOwnerAccess) return;
    const owners = await store.activeOwnerIds(actor.tenantId);
    if (owners.length === 1 && owners[0] === userId) {
      throw new AccessProblem(409, "LAST_OWNER", "This is the last active owner administrator. Add another owner first.");
    }
  }

  return Object.freeze({
    /** Verifies a password. Unknown logins, wrong passwords, locked and suspended accounts all fail the same way. */
    async verifyCredentials(rawLogin: string, credential: string): Promise<{ userId: string; tenantId: string; roles: PilotRole[] } | null> {
      const now = clock();
      let login: string;
      try { login = normalizeLogin(rawLogin); } catch { await verifyAgainstDummy(credential); return null; }
      const record = await store.findCredential(login);
      if (!record) { await verifyAgainstDummy(credential); return null; }
      if (record.lockedUntil && record.lockedUntil > now) { await verifyAgainstDummy(credential); return null; }
      const matches = await verifyPassword(credential, record.passwordHash);
      if (!matches) {
        const locked = await store.recordFailedSignIn(record.userId, now);
        if (locked) await store.auditLockout(record.userId, record.tenantId);
        return null;
      }
      if (record.userStatus !== "ACTIVE" || !record.tenantId || record.roles.length === 0) return null;
      return { userId: record.userId, tenantId: record.tenantId, roles: [...record.roles] };
    },

    async startSession(input: { userId: string; tenantId: string; tokenHash: string }) {
      return store.createSignedInSession({ ...input, now: clock() });
    },

    async currentSession(tokenHash: string) {
      return store.findCurrentSession(tokenHash, clock());
    },

    async signOut(input: { tokenHash: string; tenantId: string; userId: string }) {
      await store.revokeSessionByToken({ ...input, now: clock() });
    },

    async changeOwnPassword(actor: AccessActor, input: { currentPassword: unknown; newPassword: unknown; sessionTokenHash: string }) {
      if (typeof input.currentPassword !== "string") throw invalid("Current password is required.");
      const next = password(input.newPassword);
      const stored = await store.passwordHashOf(actor.userId);
      if (!stored || !(await verifyPassword(input.currentPassword, stored))) throw invalid("Current password is incorrect.");
      if (input.currentPassword === next) throw invalid("New password must be different.");
      await store.changeOwnPassword({ userId: actor.userId, tenantId: actor.tenantId, passwordHash: await hashPassword(next), keepSessionTokenHash: input.sessionTokenHash, now: clock() });
    },

    // ----- administration -----

    async listUsers(actor: AccessActor): Promise<{ items: AdminUserRecord[] }> {
      requireOwner(actor);
      return { items: await store.listUsers(actor.tenantId, clock()) };
    },

    async createUser(actor: AccessActor, body: Record<string, unknown>): Promise<AdminUserRecord> {
      requireOwner(actor);
      const login = normalizeLogin(body.login);
      const input = {
        login,
        nameEn: name(body.nameEn, "English name"),
        nameAr: name(body.nameAr, "Arabic name"),
        locale: locale(body.locale ?? "en"),
        roleCodes: roleCodes(body.roleCodes),
        password: password(body.password),
      };
      if (await store.loginExists(login)) throw new AccessProblem(409, "CONFLICT", "A user with this login already exists.");
      const now = clock();
      try {
        const id = await store.createUser({
          tenantId: actor.tenantId, actorId: actor.userId, login, nameEn: input.nameEn, nameAr: input.nameAr, locale: input.locale,
          roleCodes: input.roleCodes, passwordHash: await hashPassword(input.password), mustChangePassword: true, now,
        });
        return await store.getUser(actor.tenantId, id, now);
      } catch (error) { translate(error); }
    },

    async updateUser(actor: AccessActor, userId: string, body: Record<string, unknown>): Promise<AdminUserRecord> {
      requireOwner(actor);
      const changes: { nameEn?: string; nameAr?: string; locale?: "en" | "ar"; status?: UserStatus } = {};
      if (body.nameEn !== undefined) changes.nameEn = name(body.nameEn, "English name");
      if (body.nameAr !== undefined) changes.nameAr = name(body.nameAr, "Arabic name");
      if (body.locale !== undefined) changes.locale = locale(body.locale);
      if (body.status !== undefined) {
        if (body.status !== "ACTIVE" && body.status !== "SUSPENDED") throw invalid("Status must be ACTIVE or SUSPENDED.");
        changes.status = body.status;
      }
      if (Object.keys(changes).length === 0) throw invalid("Nothing to update.");
      if (changes.status === "SUSPENDED" && userId === actor.userId) throw invalid("You cannot suspend your own account.");
      await guardLastOwner(actor, userId, changes.status === "SUSPENDED");
      try {
        await store.updateUser({ tenantId: actor.tenantId, actorId: actor.userId, userId, changes, now: clock() });
        return await store.getUser(actor.tenantId, userId, clock());
      } catch (error) { translate(error); }
    },

    async replaceRoles(actor: AccessActor, userId: string, rawRoles: unknown): Promise<AdminUserRecord> {
      requireOwner(actor);
      const roles = roleCodes(rawRoles);
      await guardLastOwner(actor, userId, !roles.includes("OWNER_ADMIN"));
      try {
        await store.replaceRoles({ tenantId: actor.tenantId, actorId: actor.userId, userId, roleCodes: roles, now: clock() });
        return await store.getUser(actor.tenantId, userId, clock());
      } catch (error) { translate(error); }
    },

    async resetPassword(actor: AccessActor, userId: string, body: Record<string, unknown>): Promise<AdminUserRecord> {
      requireOwner(actor);
      const next = password(body.password);
      try {
        await store.setPassword({ tenantId: actor.tenantId, actorId: actor.userId, userId, passwordHash: await hashPassword(next), mustChangePassword: body.mustChangePassword !== false, now: clock() });
        return await store.getUser(actor.tenantId, userId, clock());
      } catch (error) { translate(error); }
    },

    async listSessions(actor: AccessActor, userId: string) {
      requireOwner(actor);
      try { return { userId, items: await store.listSessions(actor.tenantId, userId, clock()) }; } catch (error) { translate(error); }
    },

    async revokeSession(actor: AccessActor, userId: string, sessionId: string) {
      requireOwner(actor);
      try {
        await store.revokeSession({ tenantId: actor.tenantId, actorId: actor.userId, userId, sessionId, now: clock() });
        return { userId, sessionId, revoked: true };
      } catch (error) { translate(error); }
    },
  });
}

export type AccessService = ReturnType<typeof createAccessService>;
