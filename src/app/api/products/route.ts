// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyPrincipal } from "../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { ProductProblem, type ProductPrincipal as ProductServicePrincipal, type ProductRecord } from "../../../modules/products/product-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicProduct } from "../../../modules/products/product-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { productRuntime } from "../../../modules/products/product-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateProductMutationRequest } from "../../../modules/products/product-mutation-security.ts";

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
export interface ProductCollectionDependencies {
  readonly authenticate: (request: Request) => Promise<ProductServicePrincipal | null>;
  readonly list?: (input: { request: Request; masterType: "products"; principal: ProductServicePrincipal }) => Promise<readonly ProductRecord[]>;
  readonly create?: (input: { request: Request; masterType: "products"; principal: ProductServicePrincipal }) => Promise<ProductRecord>;
}
export const createPartyListHandler = (dependencies: ProductCollectionDependencies) => partyListHandler("products", {
  authenticate: dependencies.authenticate,
  ...(dependencies.list ? { list: async (input) => (await dependencies.list!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<ProductCollectionDependencies["list"]>>[0])).map((record) => toPublicProduct(record)) } : {}),
  responseHeaders: ({ principal }) => writeCapability(principal),
});
export const createPartyCreateHandler = (dependencies: ProductCollectionDependencies) => partyCreateHandler("products", {
  authenticate: dependencies.authenticate,
  ...(dependencies.create ? { create: async (input) => toPublicProduct(await dependencies.create!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<ProductCollectionDependencies["create"]>>[0])) } : {}),
});
const production: ProductCollectionDependencies = {
  authenticate: (request) => productRuntime().authenticate(request),
  list: ({ principal }) => productRuntime().service.list({ principal }),
  create: async ({ request, principal }) => { const key = validateProductMutationRequest(request), body = await json(request); return productRuntime().create({ principal, body, key }); },
};
const listProducts = createPartyListHandler(production);
export async function GET(request: Request) { return listProducts(request); }
export const POST = createPartyCreateHandler(production);
