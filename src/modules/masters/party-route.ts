import { NextResponse } from "next/server.js";

export type PartyType = "customers" | "suppliers";
export interface PartyPrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface PartyCollectionDependencies {
  readonly authenticate: (request: Request) => Promise<PartyPrincipal | null>;
  readonly list?: (input: { request: Request; masterType: PartyType; principal: PartyPrincipal }) => Promise<unknown>;
  readonly create?: (input: { request: Request; masterType: PartyType; principal: PartyPrincipal }) => Promise<unknown>;
}
export interface PartyRecordDependencies {
  readonly authenticate: (request: Request) => Promise<PartyPrincipal | null>;
  readonly get?: (input: { request: Request; masterType: PartyType; recordId: string; principal: PartyPrincipal }) => Promise<unknown>;
  readonly update?: (input: { request: Request; masterType: PartyType; recordId: string; principal: PartyPrincipal }) => Promise<unknown>;
}

function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, detail: "The request could not be authorized safely.", code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
async function authorize(authenticate: PartyCollectionDependencies["authenticate"], request: Request, mutation: boolean) {
  const principal = await authenticate(request);
  if (!principal) return { response: problem(401, "AUTHENTICATION_REQUIRED") };
  const roles = mutation ? ["OWNER_ADMIN", "OPERATIONS"] : ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
  if (!principal.roles.some((role) => roles.includes(role))) return { response: problem(403, "PERMISSION_DENIED") };
  return { principal };
}
export function partyListHandler(masterType: PartyType, dependencies: PartyCollectionDependencies) {
  return async (request: Request) => {
    const auth = await authorize(dependencies.authenticate, request, false);
    if (auth.response) return auth.response;
    if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE");
    return NextResponse.json({ items: await dependencies.list({ request, masterType, principal: auth.principal! }), nextCursor: null }, { headers: { "Cache-Control": "no-store" } });
  };
}
export function partyCreateHandler(masterType: PartyType, dependencies: PartyCollectionDependencies) {
  return async (request: Request) => {
    const auth = await authorize(dependencies.authenticate, request, true);
    if (auth.response) return auth.response;
    if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE");
    return NextResponse.json(await dependencies.create({ request, masterType, principal: auth.principal! }), { status: 201, headers: { "Cache-Control": "no-store" } });
  };
}
export function partyGetHandler(masterType: PartyType, idParameter: string, dependencies: PartyRecordDependencies) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const auth = await authorize(dependencies.authenticate, request, false);
    if (auth.response) return auth.response;
    if (!dependencies.get) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const recordId = (await context.params)[idParameter];
    return NextResponse.json(await dependencies.get({ request, masterType, recordId, principal: auth.principal! }), { headers: { "Cache-Control": "no-store" } });
  };
}
export function partyPatchHandler(masterType: PartyType, idParameter: string, dependencies: PartyRecordDependencies) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const auth = await authorize(dependencies.authenticate, request, true);
    if (auth.response) return auth.response;
    if (!dependencies.update) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const recordId = (await context.params)[idParameter];
    return NextResponse.json(await dependencies.update({ request, masterType, recordId, principal: auth.principal! }), { headers: { "Cache-Control": "no-store" } });
  };
}
