import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission } from "../../../../../../modules/access/permissions.ts";
import type { ContractLinePrincipal } from "../route.ts";

interface Dependencies {
  readonly authenticate: (request: Request) => Promise<ContractLinePrincipal | null>;
  readonly get?: (input: { request: Request; contractId: string; lineId: string; principal: ContractLinePrincipal }) => Promise<unknown>;
  readonly update?: (input: { request: Request; contractId: string; lineId: string; principal: ContractLinePrincipal; body: unknown }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ code, status }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
async function principal(deps: Dependencies, request: Request, operationId: "getContractLine" | "updateContractLine") {
  const value = await deps.authenticate(request);
  if (!value) return null;
  try { assertServerPermission(value, operationId); return value; } catch { return false; }
}
export function createContractLineGetHandler(deps: Dependencies) {
  return async (request: Request, context: { params: Promise<{ contractId: string; lineId: string }> }) => {
    const value = await principal(deps, request, "getContractLine");
    if (value === null) return problem(401, "AUTHENTICATION_REQUIRED");
    if (value === false) return problem(403, "PERMISSION_DENIED");
    if (!deps.get) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const ids = await context.params;
    return NextResponse.json(await deps.get({ request, ...ids, principal: value }), { headers: { "Cache-Control": "no-store" } });
  };
}
export function createContractLinePatchHandler(deps: Dependencies) {
  return async (request: Request, context: { params: Promise<{ contractId: string; lineId: string }> }) => {
    const value = await principal(deps, request, "updateContractLine");
    if (value === null) return problem(401, "AUTHENTICATION_REQUIRED");
    if (value === false) return problem(403, "PERMISSION_DENIED");
    if (!deps.update) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const ids = await context.params;
    return NextResponse.json(await deps.update({ request, ...ids, principal: value, body: await request.json() }), { headers: { "Cache-Control": "no-store" } });
  };
}
const unavailable: Dependencies = { authenticate: async () => null };
export const GET = createContractLineGetHandler(unavailable);
export const PATCH = createContractLinePatchHandler(unavailable);
