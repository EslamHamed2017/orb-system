// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyGetHandler, partyPatchHandler, type PartyPrincipal } from "../../../../modules/masters/party-route.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { CustomerProblem, type CustomerPrincipal as CustomerServicePrincipal, type CustomerRecord } from "../../../../modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { customerResponseVersion, toPublicCustomer } from "../../../../modules/customers/customer-response.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { customerRuntime } from "../../../../modules/customers/customer-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { validateCustomerMutationRequest } from "../../../../modules/customers/customer-mutation-security.ts";

function requireTenantPrincipal(principal: PartyPrincipal): CustomerServicePrincipal {
  if (typeof principal.tenantId !== "string") throw new CustomerProblem("PERMISSION_DENIED", 403);
  return { tenantId: principal.tenantId, userId: principal.userId, roles: principal.roles };
}
async function json(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new CustomerProblem("VALIDATION_FAILED", 400); }
}
function expectedVersion(request: Request): number {
  const match = /^"([1-9][0-9]*)"$/.exec(request.headers.get("if-match") ?? "");
  const version = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(version) || version < 1) throw new CustomerProblem("VALIDATION_FAILED", 400);
  return version;
}
export interface CustomerRecordDependencies {
  readonly authenticate: (request: Request) => Promise<CustomerServicePrincipal | null>;
  readonly get?: (input: { request: Request; masterType: "customers"; recordId: string; principal: CustomerServicePrincipal }) => Promise<CustomerRecord>;
  readonly update?: (input: { request: Request; masterType: "customers"; recordId: string; principal: CustomerServicePrincipal }) => Promise<CustomerRecord>;
}
export const createPartyGetHandler = (dependencies: CustomerRecordDependencies) => partyGetHandler("customers", "customerId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.get ? { get: async (input) => toPublicCustomer(await dependencies.get!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerRecordDependencies["get"]>>[0]), customerResponseVersion(input.request)) } : {}),
});
export const createPartyPatchHandler = (dependencies: CustomerRecordDependencies) => partyPatchHandler("customers", "customerId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.update ? { update: async (input) => toPublicCustomer(await dependencies.update!({ ...input, principal: requireTenantPrincipal(input.principal) } as Parameters<NonNullable<CustomerRecordDependencies["update"]>>[0]), customerResponseVersion(input.request)) } : {}),
});
const production: CustomerRecordDependencies = {
  authenticate: (request) => customerRuntime().authenticate(request),
  get: ({ recordId, principal }) => customerRuntime().service.get({ principal, id: recordId }),
  update: async ({ request, recordId, principal }) => { const key = validateCustomerMutationRequest(request), version = expectedVersion(request), body = await json(request); return customerRuntime().update({ principal, id: recordId, expectedVersion: version, body, key }); },
};
export const GET = createPartyGetHandler(production);
export const PATCH = createPartyPatchHandler(production);
