import type { CustomerSessionContext, CustomerSessionContextRepository } from "./customer-request-context.ts";

interface SessionContextRow {
  session_id: string;
  user_id: string;
  tenant_id: string;
  locale: string;
  roles: string[];
  mfa_satisfied_at: Date | null;
}

export interface CustomerSessionPrismaClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

const CUSTOMER_ROLES = new Set(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);

/**
 * Owner sessions require a satisfied MFA step unless ORB_OWNER_MFA_REQUIRED=0.
 * MFA enrolment is not built yet, so deployments set it to 0 until it is.
 */
export function ownerMfaRequired(env: Record<string, string | undefined> = process.env): boolean {
  return env.ORB_OWNER_MFA_REQUIRED !== "0";
}

export class PrismaCustomerSessionContextRepository implements CustomerSessionContextRepository {
  private readonly client: CustomerSessionPrismaClient;
  private readonly requireOwnerMfa: () => boolean;
  constructor(client: CustomerSessionPrismaClient, options: { requireOwnerMfa?: () => boolean } = {}) {
    this.client = client;
    this.requireOwnerMfa = options.requireOwnerMfa ?? (() => ownerMfaRequired());
  }

  async findActiveContext(tokenHash: string, now: Date): Promise<CustomerSessionContext | null> {
    const rows = await this.client.$queryRaw<SessionContextRow[]>`
      SELECT s."id" AS session_id, u."id" AS user_id, tm."tenant_id", u."locale",
             array_agg(ur."role"::text ORDER BY ur."role"::text) AS roles, s."mfa_satisfied_at"
      FROM "Session" s
      JOIN "User" u ON u."id" = s."user_id"
      JOIN "TenantMembership" tm ON tm."user_id" = u."id"
      JOIN "UserRole" ur ON ur."user_id" = u."id"
      WHERE s."token_hash" = ${tokenHash}
        AND s."expires_at" > ${now}
        AND s."revoked_at" IS NULL
        AND u."status" = 'ACTIVE'
        AND tm."status" = 'ACTIVE'
      GROUP BY s."id", u."id", tm."tenant_id", u."locale", s."mfa_satisfied_at"
    `;
    if (rows.length !== 1) return null;
    const row = rows[0];
    const roles = row.roles.filter((role) => CUSTOMER_ROLES.has(role));
    if (roles.length === 0 || (roles.includes("OWNER_ADMIN") && !row.mfa_satisfied_at && this.requireOwnerMfa())) return null;
    return Object.freeze({ sessionId: row.session_id, userId: row.user_id, tenantId: row.tenant_id, locale: row.locale, roles });
  }
}
