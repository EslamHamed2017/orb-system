import { NextResponse } from "next/server.js";

export type PartyType = "customers" | "suppliers" | "products";
export interface PartyPrincipal { readonly userId: string; readonly tenantId?: string; readonly roles: readonly string[] }
export interface PartyCollectionDependencies {
  readonly authenticate: (request: Request) => Promise<PartyPrincipal | null>;
  readonly list?: (input: { request: Request; masterType: PartyType; principal: PartyPrincipal }) => Promise<unknown>;
  readonly create?: (input: { request: Request; masterType: PartyType; principal: PartyPrincipal }) => Promise<unknown>;
  readonly responseHeaders?: (input: { request: Request; masterType: PartyType; principal: PartyPrincipal }) => HeadersInit;
}
export interface PartyRecordDependencies {
  readonly authenticate: (request: Request) => Promise<PartyPrincipal | null>;
  readonly get?: (input: { request: Request; masterType: PartyType; recordId: string; principal: PartyPrincipal }) => Promise<unknown>;
  readonly update?: (input: { request: Request; masterType: PartyType; recordId: string; principal: PartyPrincipal }) => Promise<unknown>;
  readonly responseHeaders?: (input: { request: Request; masterType: PartyType; recordId: string; principal: PartyPrincipal }) => HeadersInit;
}

function problem(status: number, code: string, detail = "The request could not be authorized safely.") {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, detail, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
async function respond(work: () => Promise<unknown>, status = 200, additionalHeaders?: HeadersInit) {
  try { const headers = new Headers(additionalHeaders); headers.set("Cache-Control", "no-store"); return NextResponse.json(await work(), { status, headers }); }
  catch (error) {
    const candidate = error as { code?: unknown; status?: unknown };
    const publicProblems: Readonly<Record<string, { status: number; detail: string }>> = Object.freeze({
      VALIDATION_FAILED: { status: 400, detail: "The request is invalid." },
      PERMISSION_DENIED: { status: 403, detail: "The requested action is not permitted." },
      RESOURCE_NOT_FOUND: { status: 404, detail: "The requested record was not found." },
      DUPLICATE_REFERENCE: { status: 409, detail: "That reference is already in use." },
      STALE_VERSION: { status: 412, detail: "The record changed since it was loaded. Refresh and try again." },
      IDEMPOTENCY_CONFLICT: { status: 409, detail: "That idempotency key was already used for a different request." },
    });
    const mapped = typeof candidate.code === "string" ? publicProblems[candidate.code] : undefined;
    if (mapped && candidate.status === mapped.status) return problem(mapped.status, candidate.code as string, mapped.detail);
    throw error;
  }
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
    const input = { request, masterType, principal: auth.principal! };
    return respond(async () => ({ items: await dependencies.list!(input), nextCursor: null }), 200, dependencies.responseHeaders?.(input));
  };
}
export function partyCreateHandler(masterType: PartyType, dependencies: PartyCollectionDependencies) {
  return async (request: Request) => {
    const auth = await authorize(dependencies.authenticate, request, true);
    if (auth.response) return auth.response;
    if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE");
    return respond(() => dependencies.create!({ request, masterType, principal: auth.principal! }), 201);
  };
}
export function partyGetHandler(masterType: PartyType, idParameter: string, dependencies: PartyRecordDependencies) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const auth = await authorize(dependencies.authenticate, request, false);
    if (auth.response) return auth.response;
    if (!dependencies.get) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const recordId = (await context.params)[idParameter];
    const input = { request, masterType, recordId, principal: auth.principal! };
    return respond(() => dependencies.get!(input), 200, dependencies.responseHeaders?.(input));
  };
}
export function partyPatchHandler(masterType: PartyType, idParameter: string, dependencies: PartyRecordDependencies) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const auth = await authorize(dependencies.authenticate, request, true);
    if (auth.response) return auth.response;
    if (!dependencies.update) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const recordId = (await context.params)[idParameter];
    return respond(() => dependencies.update!({ request, masterType, recordId, principal: auth.principal! }));
  };
}
