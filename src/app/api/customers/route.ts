// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyPrincipal } from "../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { CustomerProblem, type CustomerPrincipal as CustomerServicePrincipal, type CustomerRecord } from "../../../modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { customerResponseVersion, toPublicCustomer } from "../../../modules/customers/customer-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { customerRuntime } from "../../../modules/customers/customer-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateCustomerMutationRequest } from "../../../modules/customers/customer-mutation-security.ts";

function writeCapability(principal: PartyPrincipal): HeadersInit {
  return { "x-orb-customer-write-permitted": String(principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) };
}
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
  ...(dependencies.list ? { list: async (input) => (await dependencies.list!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerCollectionDependencies["list"]>>[0])).map((record) => toPublicCustomer(record, customerResponseVersion(input.request))) } : {}),
  responseHeaders: ({ principal }) => writeCapability(principal),
});
export const createPartyCreateHandler = (dependencies: CustomerCollectionDependencies) => partyCreateHandler("customers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.create ? { create: async (input) => toPublicCustomer(await dependencies.create!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerCollectionDependencies["create"]>>[0]), customerResponseVersion(input.request)) } : {}),
});
const production: CustomerCollectionDependencies = {
  authenticate: (request) => customerRuntime().authenticate(request),
  list: ({ principal }) => customerRuntime().service.list({ principal }),
  create: async ({ request, principal }) => { const key = validateCustomerMutationRequest(request), body = await json(request); return customerRuntime().create({ principal, body, key }); },
};
const listCustomers = createPartyListHandler(production);
export async function GET(request: Request) { const response = await listCustomers(request); if (customerResponseVersion(request) === 2) response.headers.set("x-orb-customer-schema-version", "2"); return response; }
export const POST = createPartyCreateHandler(production);
