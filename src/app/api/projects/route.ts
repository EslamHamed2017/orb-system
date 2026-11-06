import { NextResponse } from "next/server";

export interface ProjectPrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface ProjectsRouteDependencies {
  readonly authenticate: (request: Request) => Promise<ProjectPrincipal | null>;
  readonly list?: (input: { request: Request; principal: ProjectPrincipal }) => Promise<unknown>;
  readonly create?: (input: { request: Request; principal: ProjectPrincipal; body: unknown }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
async function principalOf(dependencies: ProjectsRouteDependencies, request: Request, mutation: boolean) { const principal = await dependencies.authenticate(request); if (!principal) return { response: problem(401, "AUTHENTICATION_REQUIRED") }; const allowed = mutation ? ["OWNER_ADMIN", "OPERATIONS"] : ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]; if (!principal.roles.some((role) => allowed.includes(role))) return { response: problem(403, "PERMISSION_DENIED") }; return { principal }; }
export function createProjectsGetHandler(dependencies: ProjectsRouteDependencies) { return async (request: Request) => { const auth = await principalOf(dependencies, request, false); if (auth.response) return auth.response; if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE"); return NextResponse.json({ items: await dependencies.list({ request, principal: auth.principal! }), nextCursor: null }, { headers: { "Cache-Control": "no-store" } }); }; }
export function createProjectsPostHandler(dependencies: ProjectsRouteDependencies) { return async (request: Request) => { const auth = await principalOf(dependencies, request, true); if (auth.response) return auth.response; if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE"); return NextResponse.json(await dependencies.create({ request, principal: auth.principal!, body: await request.json() }), { status: 201, headers: { "Cache-Control": "no-store" } }); }; }
const unavailable: ProjectsRouteDependencies = { authenticate: async () => null };
export const GET = createProjectsGetHandler(unavailable); export const POST = createProjectsPostHandler(unavailable);
