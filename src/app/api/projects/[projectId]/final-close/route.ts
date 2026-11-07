import { NextResponse } from "next/server";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { isProblemError } from "../../../../../platform/http/problem.ts";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface ClosureRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly execute?: (input: Record<string, unknown>) => Promise<{ value: unknown; replayed: boolean }>;
}
const ALLOWED_ROLES = new Set(["OWNER_ADMIN"]);
function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code,
    status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
function expectedVersion(request: Request) {
  const value = request.headers.get("if-match");
  return value && /^"[1-9][0-9]*"$/.test(value) ? Number(value.slice(1, -1)) : null;
}
export function createFinalClosePostHandler(dependencies: ClosureRouteDependencies) {
  return async (request: Request, context: { params: Promise<{ projectId: string }> }) => {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ALLOWED_ROLES.has(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.execute) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const version = expectedVersion(request);
    if (version === null) return problem(428, "PRECONDITION_REQUIRED");
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return problem(400, "VALIDATION_FAILED");
    try {
      const { projectId } = await context.params;
      const result = await dependencies.execute({ ...(body as Record<string, unknown>), projectId, expectedVersion: version, principal,
        idempotencyKey: request.headers.get("idempotency-key"), correlationId: request.headers.get("x-correlation-id") ?? crypto.randomUUID() });
      return NextResponse.json(result.value, { status: 200, headers: { "Cache-Control": "no-store", "Idempotent-Replay": String(result.replayed) } });
    } catch (error) {
      if (isProblemError(error)) return NextResponse.json(error.problem, { status: error.problem.status,
        headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
      throw error;
    }
  };
}
export const POST = createFinalClosePostHandler({ authenticate: async () => null });
