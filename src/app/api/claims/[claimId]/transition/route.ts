import { NextResponse } from "next/server";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { isProblemError } from "../../../../../platform/http/problem.ts";

interface Principal { readonly userId: string; readonly displayName?: string; readonly roles: readonly string[] }
export interface ClaimRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly execute?: (input: Record<string, unknown>) => Promise<{ value: unknown; replayed: boolean }>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
function expectedVersion(request: Request) { const value = request.headers.get("if-match"); return value && /^"[1-9][0-9]*"$/.test(value) ? Number(value.slice(1, -1)) : null; }
export function createTransitionClaimPostHandler(dependencies: ClaimRouteDependencies) {
  return async (request: Request, context: { params: Promise<{ claimId: string }> }) => {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.execute) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const version = expectedVersion(request); if (version === null) return problem(428, "PRECONDITION_REQUIRED");
    try {
      const params = await context.params; const body = await request.json() as Record<string, unknown>;
      const result = await dependencies.execute({ ...body, claimId: params.claimId, expectedVersion: version, principal,
        idempotencyKey: request.headers.get("idempotency-key"), correlationId: request.headers.get("x-correlation-id") ?? crypto.randomUUID() });
      return NextResponse.json(result.value, { status: 200, headers: { "Cache-Control": "no-store", "Idempotent-Replay": String(result.replayed) } });
    } catch (error) {
      if (isProblemError(error)) return NextResponse.json(error.problem, { status: error.problem.status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
      throw error;
    }
  };
}
export const POST = createTransitionClaimPostHandler({ authenticate: async () => null });
