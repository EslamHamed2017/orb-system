// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyPrincipal } from "../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { CustomerProblem, type CustomerPrincipal as CustomerServicePrincipal, type CustomerRecord } from "../../../modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicCustomer } from "../../../modules/customers/customer-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { customerRuntime } from "../../../modules/customers/customer-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateCustomerMutationRequest } from "../../../modules/customers/customer-mutation-security.ts";

function requireTenantPrincipal(principal: PartyPrincipal): CustomerServicePrincipal {
  if (typeof principal.tenantId !== "string") throw new CustomerProblem("PERMISSION_DENIED", 403);
  return { tenantId: principal.tenantId, userId: principal.userId, roles: principal.roles };
}
async function json(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new CustomerProblem("VALIDATION_FAILED", 400); }
}
export interface CustomerCollectionDependencies {
  readonly authenticate: (request: Request) => Promise<CustomerServicePrincipal | null>;
  readonly list?: (input: { request: Request; masterType: "customers"; principal: CustomerServicePrincipal }) => Promise<readonly CustomerRecord[]>;
  readonly create?: (input: { request: Request; masterType: "customers"; principal: CustomerServicePrincipal }) => Promise<CustomerRecord>;
}
export const createPartyListHandler = (dependencies: CustomerCollectionDependencies) => partyListHandler("customers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.list ? { list: async (input) => (await dependencies.list!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerCollectionDependencies["list"]>>[0])).map(toPublicCustomer) } : {}),
});
export const createPartyCreateHandler = (dependencies: CustomerCollectionDependencies) => partyCreateHandler("customers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.create ? { create: async (input) => toPublicCustomer(await dependencies.create!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerCollectionDependencies["create"]>>[0])) } : {}),
});
const production: CustomerCollectionDependencies = {
  authenticate: (request) => customerRuntime().authenticate(request),
  list: ({ principal }) => customerRuntime().service.list({ principal }),
  create: async ({ request, principal }) => { const key = validateCustomerMutationRequest(request), body = await json(request); return customerRuntime().create({ principal, body, key }); },
};
export const GET = createPartyListHandler(production);
export const POST = createPartyCreateHandler(production);
