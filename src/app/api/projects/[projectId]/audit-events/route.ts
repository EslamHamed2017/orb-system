import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { listProjectAuditEvents, type AuditPageRepository } from "../../../../../modules/audit/audit-query.ts";

const ALLOWED_ROLES = new Set(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);

export interface AuditRoutePrincipal { readonly roles: readonly string[] }
export interface AuditRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<AuditRoutePrincipal | null>;
  readonly repository: AuditPageRepository;
}

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: `https://orb.invalid/problems/${code.toLowerCase()}`, title: code, status, detail, code },
    { status, headers: { "content-type": "application/problem+json" } });
}

export function createAuditEventsGetHandler(dependencies: AuditRouteDependencies) {
  return async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (principal === null) return problem(401, "UNAUTHENTICATED", "Authentication is required.");
    if (!principal.roles.some((role) => ALLOWED_ROLES.has(role))) return problem(403, "PERMISSION_DENIED", "Permission is denied.");

    const { projectId } = await context.params;
    const cursor = request.nextUrl.searchParams.get("cursor");
    const rawLimit = request.nextUrl.searchParams.get("limit") ?? "20";
    if (!/^\d+$/.test(rawLimit)) return problem(400, "VALIDATION_FAILED", "limit must be an integer from 1 through 100.");
    const limit = Number(rawLimit);
    try {
      return NextResponse.json(await listProjectAuditEvents({ projectId, cursor, limit, repository: dependencies.repository }));
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) return problem(400, "VALIDATION_FAILED", error.message);
      throw error;
    }
  };
}

// Access/session wiring is owned by ORB-R1-0210. Until injected, fail closed rather than expose audit data.
export async function GET() {
  return problem(503, "DEPENDENCY_UNAVAILABLE", "Audit route authentication is not configured.");
}
