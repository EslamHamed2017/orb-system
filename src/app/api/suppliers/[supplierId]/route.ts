// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyGetHandler, partyPatchHandler, type PartyPrincipal } from "../../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { SupplierProblem, type SupplierPrincipal as SupplierServicePrincipal, type SupplierRecord } from "../../../../modules/suppliers/supplier-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicSupplier } from "../../../../modules/suppliers/supplier-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { supplierRuntime } from "../../../../modules/suppliers/supplier-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateSupplierMutationRequest } from "../../../../modules/suppliers/supplier-mutation-security.ts";

function writeCapability(principal: PartyPrincipal): HeadersInit {
  return { "x-orb-supplier-write-permitted": String(principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) };
}
function requireTenantPrincipal(principal: PartyPrincipal): SupplierServicePrincipal {
  if (typeof principal.tenantId !== "string") throw new SupplierProblem("PERMISSION_DENIED", 403);
  return { tenantId: principal.tenantId, userId: principal.userId, roles: principal.roles };
}
async function json(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new SupplierProblem("VALIDATION_FAILED", 400); }
}
function expectedVersion(request: Request): number {
  const match = /^"([1-9][0-9]*)"$/.exec(request.headers.get("if-match") ?? "");
  const version = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(version) || version < 1) throw new SupplierProblem("VALIDATION_FAILED", 400);
  return version;
}
export interface SupplierRecordDependencies {
  readonly authenticate: (request: Request) => Promise<SupplierServicePrincipal | null>;
  readonly get?: (input: { request: Request; masterType: "suppliers"; recordId: string; principal: SupplierServicePrincipal }) => Promise<SupplierRecord>;
  readonly update?: (input: { request: Request; masterType: "suppliers"; recordId: string; principal: SupplierServicePrincipal }) => Promise<SupplierRecord>;
}
export const createPartyGetHandler = (dependencies: SupplierRecordDependencies) => partyGetHandler("suppliers", "supplierId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.get ? { get: async (input) => toPublicSupplier(await dependencies.get!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<SupplierRecordDependencies["get"]>>[0])) } : {}),
  responseHeaders: ({ principal }) => writeCapability(principal),
});
export const createPartyPatchHandler = (dependencies: SupplierRecordDependencies) => partyPatchHandler("suppliers", "supplierId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.update ? { update: async (input) => toPublicSupplier(await dependencies.update!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<SupplierRecordDependencies["update"]>>[0])) } : {}),
});
const production: SupplierRecordDependencies = {
  authenticate: (request) => supplierRuntime().authenticate(request),
  get: ({ recordId, principal }) => supplierRuntime().service.get({ principal, id: recordId }),
  update: async ({ request, recordId, principal }) => { const key = validateSupplierMutationRequest(request), version = expectedVersion(request), body = await json(request); return supplierRuntime().update({ principal, id: recordId, expectedVersion: version, body, key }); },
};
export const GET = createPartyGetHandler(production);
export const PATCH = createPartyPatchHandler(production);
