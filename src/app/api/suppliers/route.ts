// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyPrincipal } from "../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { SupplierProblem, type SupplierPrincipal as SupplierServicePrincipal, type SupplierRecord } from "../../../modules/suppliers/supplier-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicSupplier } from "../../../modules/suppliers/supplier-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { supplierRuntime } from "../../../modules/suppliers/supplier-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateSupplierMutationRequest } from "../../../modules/suppliers/supplier-mutation-security.ts";

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
export interface SupplierCollectionDependencies {
  readonly authenticate: (request: Request) => Promise<SupplierServicePrincipal | null>;
  readonly list?: (input: { request: Request; masterType: "suppliers"; principal: SupplierServicePrincipal }) => Promise<readonly SupplierRecord[]>;
  readonly create?: (input: { request: Request; masterType: "suppliers"; principal: SupplierServicePrincipal }) => Promise<SupplierRecord>;
}
export const createPartyListHandler = (dependencies: SupplierCollectionDependencies) => partyListHandler("suppliers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.list ? { list: async (input) => (await dependencies.list!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<SupplierCollectionDependencies["list"]>>[0])).map((record) => toPublicSupplier(record)) } : {}),
  responseHeaders: ({ principal }) => writeCapability(principal),
});
export const createPartyCreateHandler = (dependencies: SupplierCollectionDependencies) => partyCreateHandler("suppliers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.create ? { create: async (input) => toPublicSupplier(await dependencies.create!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<SupplierCollectionDependencies["create"]>>[0])) } : {}),
});
const production: SupplierCollectionDependencies = {
  authenticate: (request) => supplierRuntime().authenticate(request),
  list: ({ principal }) => supplierRuntime().service.list({ principal }),
  create: async ({ request, principal }) => { const key = validateSupplierMutationRequest(request), body = await json(request); return supplierRuntime().create({ principal, body, key }); },
};
const listSuppliers = createPartyListHandler(production);
export async function GET(request: Request) { return listSuppliers(request); }
export const POST = createPartyCreateHandler(production);
