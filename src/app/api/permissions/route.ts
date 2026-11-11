import { NextResponse } from "next/server.js";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { accessProblem, requireAccessOwner, type AccessPrincipal } from "../../../modules/access/administration-http.ts";
export interface PermissionsRouteDependencies { readonly authenticate: (request: Request) => Promise<AccessPrincipal | null>; readonly list?: (input: { request: Request; principal: AccessPrincipal }) => Promise<unknown>; }
export function createPermissionsGetHandler(dependencies: PermissionsRouteDependencies) { return async function GET(request: Request) { const principal = await requireAccessOwner(request, dependencies.authenticate); if (principal instanceof Response) return principal; if (!dependencies.list) return accessProblem(503, "DEPENDENCY_UNAVAILABLE"); return NextResponse.json(await dependencies.list({ request, principal }), { headers: { "Cache-Control": "no-store" } }); }; }
export const GET=createPermissionsGetHandler({ authenticate: async()=>null });
