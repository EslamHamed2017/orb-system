// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyGetHandler, partyPatchHandler, type PartyPrincipal } from "../../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { ProductProblem, type ProductPrincipal as ProductServicePrincipal, type ProductRecord } from "../../../../modules/products/product-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicProduct } from "../../../../modules/products/product-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { productRuntime } from "../../../../modules/products/product-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateProductMutationRequest } from "../../../../modules/products/product-mutation-security.ts";

function writeCapability(principal: PartyPrincipal): HeadersInit {
  return { "x-orb-product-write-permitted": String(principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) };
}
function requireTenantPrincipal(principal: PartyPrincipal): ProductServicePrincipal {
  if (typeof principal.tenantId !== "string") throw new ProductProblem("PERMISSION_DENIED", 403);
  return { tenantId: principal.tenantId, userId: principal.userId, roles: principal.roles };
}
async function json(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new ProductProblem("VALIDATION_FAILED", 400); }
}
function expectedVersion(request: Request): number {
  const match = /^"([1-9][0-9]*)"$/.exec(request.headers.get("if-match") ?? "");
  const version = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(version) || version < 1) throw new ProductProblem("VALIDATION_FAILED", 400);
  return version;
}
export interface ProductRecordDependencies {
  readonly authenticate: (request: Request) => Promise<ProductServicePrincipal | null>;
  readonly get?: (input: { request: Request; masterType: "products"; recordId: string; principal: ProductServicePrincipal }) => Promise<ProductRecord>;
  readonly update?: (input: { request: Request; masterType: "products"; recordId: string; principal: ProductServicePrincipal }) => Promise<ProductRecord>;
}
export const createPartyGetHandler = (dependencies: ProductRecordDependencies) => partyGetHandler("products", "productId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.get ? { get: async (input) => toPublicProduct(await dependencies.get!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<ProductRecordDependencies["get"]>>[0])) } : {}),
  responseHeaders: ({ principal }) => writeCapability(principal),
});
export const createPartyPatchHandler = (dependencies: ProductRecordDependencies) => partyPatchHandler("products", "productId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.update ? { update: async (input) => toPublicProduct(await dependencies.update!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<ProductRecordDependencies["update"]>>[0])) } : {}),
});
const production: ProductRecordDependencies = {
  authenticate: (request) => productRuntime().authenticate(request),
  get: ({ recordId, principal }) => productRuntime().service.get({ principal, id: recordId }),
  update: async ({ request, recordId, principal }) => { const key = validateProductMutationRequest(request), version = expectedVersion(request), body = await json(request); return productRuntime().update({ principal, id: recordId, expectedVersion: version, body, key }); },
};
export const GET = createPartyGetHandler(production);
export const PATCH = createPartyPatchHandler(production);
