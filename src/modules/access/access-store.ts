import type { PrismaClient } from "@prisma/client";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PILOT_ROLES, type PilotRole } from "./roles.ts";

/** Persistence for sign-in, sessions, and user administration. All admin reads are tenant-scoped. */

export const LOCK_AFTER_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_HOURS = 12;

export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface CredentialRecord {
  readonly userId: string;
  readonly passwordHash: string;
  readonly lockedUntil: Date | null;
  readonly userStatus: string;
  readonly tenantId: string | null;
  readonly roles: readonly PilotRole[];
}

export interface AdminUserRecord {
  readonly id: string;
  readonly login: string | null;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly locale: "en" | "ar";
  readonly status: UserStatus;
  readonly roleCodes: readonly PilotRole[];
  readonly activeSessionCount: number;
  readonly lastActiveAt: string | null;
  readonly mustChangePassword: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionSummary {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly active: boolean;
}

export interface CurrentSessionRecord {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly login: string | null;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly locale: "en" | "ar";
  readonly roles: readonly PilotRole[];
  readonly mustChangePassword: boolean;
  readonly version: number;
  readonly expiresAt: string;
}

export type AccessAuditAction =
  | "USER_CREATED" | "USER_UPDATED" | "USER_SUSPENDED" | "USER_REACTIVATED" | "ROLES_REPLACED"
  | "PASSWORD_SET" | "PASSWORD_CHANGED" | "SESSION_REVOKED" | "SIGN_IN_SUCCEEDED" | "SIGN_IN_LOCKED" | "SIGNED_OUT";

const ROLE_SET = new Set<string>(PILOT_ROLES);
const pilotRoles = (values: readonly string[]): PilotRole[] =>
  values.filter((value): value is PilotRole => ROLE_SET.has(value)).sort();
const localeOf = (value: string): "en" | "ar" => (value === "ar" ? "ar" : "en");
const statusOf = (value: string): UserStatus => (value === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");

export class AccessStoreError extends Error {
  readonly code: "NOT_FOUND" | "CONFLICT";
  constructor(code: "NOT_FOUND" | "CONFLICT", message: string) {
    super(message);
    this.code = code;
  }
}

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export class PrismaAccessStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ---------- sign-in ----------

  async findCredential(login: string): Promise<CredentialRecord | null> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { login },
      include: { User: { include: { UserRole: true, TenantMembership: { where: { status: "ACTIVE" } } } } },
    });
    if (!credential) return null;
    const memberships = credential.User.TenantMembership;
    return {
      userId: credential.user_id,
      passwordHash: credential.password_hash,
      lockedUntil: credential.locked_until,
      userStatus: credential.User.status,
      tenantId: memberships.length === 1 ? memberships[0].tenant_id : null,
      roles: pilotRoles(credential.User.UserRole.map((row) => row.role)),
    };
  }

  /** Increments the failure counter; returns true when this failure locked the account. */
  async recordFailedSignIn(userId: string, now: Date): Promise<boolean> {
    const updated = await this.prisma.userCredential.update({
      where: { user_id: userId },
      data: { failed_attempts: { increment: 1 }, updated_at: now },
    });
    if (updated.failed_attempts < LOCK_AFTER_FAILED_ATTEMPTS) return false;
    await this.prisma.userCredential.update({
      where: { user_id: userId },
      data: { failed_attempts: 0, locked_until: new Date(now.getTime() + LOCK_MINUTES * 60_000), updated_at: now },
    });
    return true;
  }

  async createSignedInSession(input: { userId: string; tenantId: string; tokenHash: string; now: Date }): Promise<{ sessionId: string; version: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userCredential.update({
        where: { user_id: input.userId },
        data: { failed_attempts: 0, locked_until: null, updated_at: input.now },
      });
      const session = await tx.session.create({
        data: { user_id: input.userId, token_hash: input.tokenHash, expires_at: new Date(input.now.getTime() + SESSION_HOURS * 3_600_000) },
      });
      await audit(tx, { tenantId: input.tenantId, actorId: input.userId, subjectUserId: input.userId, action: "SIGN_IN_SUCCEEDED", details: { sessionId: session.id } });
      return { sessionId: session.id, version: session.version };
    });
  }

  async auditLockout(userId: string, tenantId: string | null): Promise<void> {
    if (!tenantId) return;
    await audit(this.prisma, { tenantId, actorId: null, subjectUserId: userId, action: "SIGN_IN_LOCKED", details: {} });
  }

  // ---------- current session ----------

  async findCurrentSession(tokenHash: string, now: Date): Promise<CurrentSessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { token_hash: tokenHash },
      include: { User: { include: { UserRole: true, UserCredential: true, TenantMembership: { where: { status: "ACTIVE" } } } } },
    });
    if (!session || session.revoked_at || session.expires_at <= now) return null;
    const user = session.User;
    if (user.status !== "ACTIVE" || user.TenantMembership.length !== 1) return null;
    return {
      sessionId: session.id,
      userId: user.id,
      tenantId: user.TenantMembership[0].tenant_id,
      login: user.UserCredential?.login ?? null,
      nameEn: user.name_en,
      nameAr: user.name_ar,
      locale: localeOf(user.locale),
      roles: pilotRoles(user.UserRole.map((row) => row.role)),
      mustChangePassword: user.UserCredential?.must_change_password ?? false,
      version: session.version,
      expiresAt: session.expires_at.toISOString(),
    };
  }

  async revokeSessionByToken(input: { tokenHash: string; tenantId: string; userId: string; now: Date }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { token_hash: input.tokenHash } });
      if (!session || session.revoked_at) return;
      await tx.session.update({ where: { id: session.id }, data: { revoked_at: input.now, version: { increment: 1 } } });
      await audit(tx, { tenantId: input.tenantId, actorId: input.userId, subjectUserId: input.userId, action: "SIGNED_OUT", details: { sessionId: session.id } });
    });
  }

  async changeOwnPassword(input: { userId: string; tenantId: string; passwordHash: string; keepSessionTokenHash: string; now: Date }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userCredential.update({
        where: { user_id: input.userId },
        data: { password_hash: input.passwordHash, password_changed_at: input.now, must_change_password: false, updated_at: input.now },
      });
      await tx.session.updateMany({
        where: { user_id: input.userId, revoked_at: null, NOT: { token_hash: input.keepSessionTokenHash } },
        data: { revoked_at: input.now },
      });
      await audit(tx, { tenantId: input.tenantId, actorId: input.userId, subjectUserId: input.userId, action: "PASSWORD_CHANGED", details: {} });
    });
  }

  async passwordHashOf(userId: string): Promise<string | null> {
    const credential = await this.prisma.userCredential.findUnique({ where: { user_id: userId } });
    return credential?.password_hash ?? null;
  }

  // ---------- user administration (tenant-scoped) ----------

  async listUsers(tenantId: string, now: Date): Promise<AdminUserRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { TenantMembership: { some: { tenant_id: tenantId } } },
      include: { UserRole: true, UserCredential: true, Session: { orderBy: { expires_at: "desc" } } },
      orderBy: { name_en: "asc" },
    });
    return users.map((user) => toAdminUser(user, now));
  }

  async getUser(tenantId: string, userId: string, now: Date): Promise<AdminUserRecord> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, TenantMembership: { some: { tenant_id: tenantId } } },
      include: { UserRole: true, UserCredential: true, Session: { orderBy: { expires_at: "desc" } } },
    });
    if (!user) throw new AccessStoreError("NOT_FOUND", "User not found");
    return toAdminUser(user, now);
  }

  async loginExists(login: string): Promise<boolean> {
    return (await this.prisma.userCredential.count({ where: { login } })) > 0;
  }

  async createUser(input: {
    tenantId: string; actorId: string | null; login: string; nameEn: string; nameAr: string; locale: "en" | "ar";
    roleCodes: readonly PilotRole[]; passwordHash: string; mustChangePassword: boolean; now: Date;
  }): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      if (await tx.userCredential.count({ where: { login: input.login } })) throw new AccessStoreError("CONFLICT", "Login already exists");
      const user = await tx.user.create({
        data: {
          auth_subject: `password:${input.login}`, name_en: input.nameEn, name_ar: input.nameAr, locale: input.locale,
          status: "ACTIVE", mfa_state: "NOT_ENROLLED", updated_at: input.now,
        },
      });
      await tx.tenantMembership.create({ data: { tenant_id: input.tenantId, user_id: user.id, status: "ACTIVE" } });
      for (const role of input.roleCodes) await tx.userRole.create({ data: { user_id: user.id, role } });
      await tx.userCredential.create({
        data: { user_id: user.id, login: input.login, password_hash: input.passwordHash, must_change_password: input.mustChangePassword, password_changed_at: input.now, updated_at: input.now },
      });
      await audit(tx, {
        tenantId: input.tenantId, actorId: input.actorId, subjectUserId: user.id, action: "USER_CREATED",
        details: { login: input.login, nameEn: input.nameEn, nameAr: input.nameAr, locale: input.locale, roleCodes: [...input.roleCodes] },
      });
      return user.id;
    });
  }

  async updateUser(input: {
    tenantId: string; actorId: string; userId: string; now: Date;
    changes: { nameEn?: string; nameAr?: string; locale?: "en" | "ar"; status?: UserStatus };
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.requireTenantUser(tx, input.tenantId, input.userId);
      const { changes } = input;
      await tx.user.update({
        where: { id: input.userId },
        data: {
          ...(changes.nameEn === undefined ? {} : { name_en: changes.nameEn }),
          ...(changes.nameAr === undefined ? {} : { name_ar: changes.nameAr }),
          ...(changes.locale === undefined ? {} : { locale: changes.locale }),
          ...(changes.status === undefined ? {} : { status: changes.status }),
          updated_at: input.now,
        },
      });
      const statusChanged = changes.status !== undefined && changes.status !== before.status;
      if (statusChanged && changes.status === "SUSPENDED") {
        await tx.session.updateMany({ where: { user_id: input.userId, revoked_at: null }, data: { revoked_at: input.now } });
      }
      const action: AccessAuditAction = !statusChanged ? "USER_UPDATED" : changes.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED";
      await audit(tx, {
        tenantId: input.tenantId, actorId: input.actorId, subjectUserId: input.userId, action,
        details: { before: { nameEn: before.name_en, nameAr: before.name_ar, locale: before.locale, status: before.status }, changes },
      });
    });
  }

  async replaceRoles(input: { tenantId: string; actorId: string; userId: string; roleCodes: readonly PilotRole[]; now: Date }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireTenantUser(tx, input.tenantId, input.userId);
      const current = pilotRoles((await tx.userRole.findMany({ where: { user_id: input.userId } })).map((row) => row.role));
      await tx.userRole.deleteMany({ where: { user_id: input.userId } });
      for (const role of input.roleCodes) await tx.userRole.create({ data: { user_id: input.userId, role } });
      // A privilege change forces the user to sign in again.
      await tx.session.updateMany({ where: { user_id: input.userId, revoked_at: null }, data: { revoked_at: input.now } });
      await tx.user.update({ where: { id: input.userId }, data: { updated_at: input.now } });
      await audit(tx, { tenantId: input.tenantId, actorId: input.actorId, subjectUserId: input.userId, action: "ROLES_REPLACED", details: { before: current, after: [...input.roleCodes] } });
    });
  }

  async setPassword(input: { tenantId: string; actorId: string; userId: string; passwordHash: string; mustChangePassword: boolean; now: Date }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireTenantUser(tx, input.tenantId, input.userId);
      await tx.userCredential.update({
        where: { user_id: input.userId },
        data: { password_hash: input.passwordHash, must_change_password: input.mustChangePassword, password_changed_at: input.now, failed_attempts: 0, locked_until: null, updated_at: input.now },
      });
      await tx.session.updateMany({ where: { user_id: input.userId, revoked_at: null }, data: { revoked_at: input.now } });
      await audit(tx, { tenantId: input.tenantId, actorId: input.actorId, subjectUserId: input.userId, action: "PASSWORD_SET", details: { mustChangePassword: input.mustChangePassword } });
    });
  }

  async listSessions(tenantId: string, userId: string, now: Date): Promise<SessionSummary[]> {
    await this.requireTenantUser(this.prisma, tenantId, userId);
    const sessions = await this.prisma.session.findMany({ where: { user_id: userId }, orderBy: { expires_at: "desc" }, take: 50 });
    return sessions.map((session) => ({
      sessionId: session.id,
      createdAt: new Date(session.expires_at.getTime() - SESSION_HOURS * 3_600_000).toISOString(),
      expiresAt: session.expires_at.toISOString(),
      revokedAt: session.revoked_at?.toISOString() ?? null,
      active: !session.revoked_at && session.expires_at > now,
    }));
  }

  async revokeSession(input: { tenantId: string; actorId: string; userId: string; sessionId: string; now: Date }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireTenantUser(tx, input.tenantId, input.userId);
      const session = await tx.session.findFirst({ where: { id: input.sessionId, user_id: input.userId } });
      if (!session) throw new AccessStoreError("NOT_FOUND", "Session not found");
      if (session.revoked_at) return;
      await tx.session.update({ where: { id: session.id }, data: { revoked_at: input.now, version: { increment: 1 } } });
      await audit(tx, { tenantId: input.tenantId, actorId: input.actorId, subjectUserId: input.userId, action: "SESSION_REVOKED", details: { sessionId: session.id } });
    });
  }

  /** Active owners in the tenant, used to stop the last owner from being locked out. */
  async activeOwnerIds(tenantId: string): Promise<string[]> {
    const owners = await this.prisma.user.findMany({
      where: { status: "ACTIVE", UserRole: { some: { role: "OWNER_ADMIN" } }, TenantMembership: { some: { tenant_id: tenantId, status: "ACTIVE" } } },
      select: { id: true },
    });
    return owners.map((owner) => owner.id);
  }

  private async requireTenantUser(tx: Tx, tenantId: string, userId: string) {
    const user = await tx.user.findFirst({ where: { id: userId, TenantMembership: { some: { tenant_id: tenantId } } } });
    if (!user) throw new AccessStoreError("NOT_FOUND", "User not found");
    return user;
  }
}

async function audit(tx: Tx, event: { tenantId: string; actorId: string | null; subjectUserId: string; action: AccessAuditAction; details: Record<string, unknown> }) {
  await tx.accessAuditEvent.create({
    data: { tenant_id: event.tenantId, actor_id: event.actorId, subject_user_id: event.subjectUserId, action: event.action, details: event.details as never },
  });
}

type UserWithRelations = {
  id: string; name_en: string; name_ar: string; locale: string; status: string; created_at: Date; updated_at: Date;
  UserRole: { role: string }[];
  UserCredential: { login: string; must_change_password: boolean } | null;
  Session: { expires_at: Date; revoked_at: Date | null }[];
};

function toAdminUser(user: UserWithRelations, now: Date): AdminUserRecord {
  const active = user.Session.filter((session) => !session.revoked_at && session.expires_at > now);
  const latest = user.Session[0];
  return {
    id: user.id,
    login: user.UserCredential?.login ?? null,
    nameEn: user.name_en,
    nameAr: user.name_ar,
    locale: localeOf(user.locale),
    status: statusOf(user.status),
    roleCodes: pilotRoles(user.UserRole.map((row) => row.role)),
    activeSessionCount: active.length,
    lastActiveAt: latest ? new Date(latest.expires_at.getTime() - SESSION_HOURS * 3_600_000).toISOString() : null,
    mustChangePassword: user.UserCredential?.must_change_password ?? false,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  };
}
