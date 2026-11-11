import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission } from "../../../../../../../modules/access/permissions.ts";
import type { ContractLinePrincipal } from "../../route.ts";

interface Dependencies {
  readonly authenticate: (request: Request) => Promise<ContractLinePrincipal | null>;
  readonly list?: (input: { request: Request; contractId: string; lineId: string; principal: ContractLinePrincipal }) => Promise<unknown>;
}
export function createContractLineVersionsGetHandler(deps: Dependencies) {
  return async (request: Request, context: { params: Promise<{ contractId: string; lineId: string }> }) => {
    const principal = await deps.authenticate(request);
    if (!principal) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    try { assertServerPermission(principal, "listContractLineVersions"); } catch { return NextResponse.json({ code: "PERMISSION_DENIED" }, { status: 403 }); }
    if (!deps.list) return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503 });
    const ids = await context.params;
    return NextResponse.json({ items: await deps.list({ request, ...ids, principal }) }, { headers: { "Cache-Control": "no-store" } });
  };
}
const unavailable: Dependencies = { authenticate: async () => null };
export const GET = createContractLineVersionsGetHandler(unavailable);
