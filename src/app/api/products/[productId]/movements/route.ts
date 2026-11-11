import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";

export interface ProductMovementPrincipal extends OperationPrincipal {}
export interface ProductMovementsRouteDependencies {
  readonly authenticate: (request: Request) => Promise<ProductMovementPrincipal | null>;
  readonly list?: (input: { request: Request; productId: string; projectId?: string; principal: ProductMovementPrincipal }) => Promise<unknown>;
}
function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, detail: "The request could not be authorized safely.", code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
export function createProductMovementsGetHandler(dependencies: ProductMovementsRouteDependencies) {
  return async (request: Request, context: { params: Promise<{ productId: string }> }) => {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    try { assertServerPermission(principal, "listProductMovements"); } catch { return problem(403, "PERMISSION_DENIED"); }
    if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { productId } = await context.params;
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return NextResponse.json(await dependencies.list({ request, productId, projectId, principal }), { headers: { "Cache-Control": "no-store" } });
  };
}
export const GET = createProductMovementsGetHandler({ authenticate: async () => null });
