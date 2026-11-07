import { NextResponse } from "next/server";

interface Principal { readonly userId: string; readonly roles: readonly string[] }
export interface DocumentStatusRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly get?: (input: { request: Request; documentId: string; principal: Principal }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createDocumentStatusGetHandler(dependencies: DocumentStatusRouteDependencies) {
  return async (request: Request, context: { params: Promise<{ documentId: string }> }) => {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"].includes(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.get) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { documentId } = await context.params;
    return NextResponse.json(await dependencies.get({ request, documentId, principal }), { status: 200, headers: { "Cache-Control": "no-store" } });
  };
}
export const GET = createDocumentStatusGetHandler({ authenticate: async () => null });
