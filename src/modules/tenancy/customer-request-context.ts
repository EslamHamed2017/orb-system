import { createHash } from "node:crypto";

export interface CustomerSessionContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly locale: string;
}
export interface CustomerSessionContextRepository {
  readonly findActiveContext: (tokenHash: string, now: Date) => Promise<CustomerSessionContext | null>;
}

const SESSION_COOKIE = "__Host-orb_session";
const TOKEN = /^[A-Za-z0-9_-]{32,256}$/;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return TOKEN.test(value) ? value : null;
    } catch { return null; }
  }
  return null;
}

export function createCustomerRequestAuthenticator(repository: CustomerSessionContextRepository & { readonly now?: () => Date }) {
  return async (request: Request) => {
    const token = sessionToken(request);
    if (!token) return null;
    const context = await repository.findActiveContext(hashSessionToken(token), repository.now?.() ?? new Date());
    return context ? Object.freeze({ tenantId: context.tenantId, userId: context.userId, roles: [...context.roles] }) : null;
  };
}
