import { NextResponse } from "next/server";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface CancelDocumentRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly cancel?: (input: { request: Request; documentId: string; principal: Principal }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createCancelDocumentPostHandler(dependencies: CancelDocumentRouteDependencies) {
  return async (request: Request, context: { params: Promise<{ documentId: string }> }) => {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ["OWNER_ADMIN", "OPERATIONS"].includes(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.cancel) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { documentId } = await context.params;
    return NextResponse.json(await dependencies.cancel({ request, documentId, principal }), { status: 200, headers: { "Cache-Control": "no-store" } });
  };
}
export const POST = createCancelDocumentPostHandler({ authenticate: async () => null });
