// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyGetHandler, partyPatchHandler, type PartyPrincipal, type PartyRecordDependencies } from "../../../../modules/masters/party-route.ts";
import type { CustomerRecord } from "../../../../modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicCustomer } from "../../../../modules/customers/customer-response.ts";

export interface CustomerRecordDependencies {
  readonly authenticate: PartyRecordDependencies["authenticate"];
  readonly get?: (input: { request: Request; masterType: "customers"; recordId: string; principal: PartyPrincipal }) => Promise<CustomerRecord>;
  readonly update?: (input: { request: Request; masterType: "customers"; recordId: string; principal: PartyPrincipal }) => Promise<CustomerRecord>;
}
export const createPartyGetHandler = (dependencies: CustomerRecordDependencies) => partyGetHandler("customers", "customerId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.get ? { get: async (input) => toPublicCustomer(await dependencies.get!(input as Parameters<NonNullable<CustomerRecordDependencies["get"]>>[0])) } : {}),
});
export const createPartyPatchHandler = (dependencies: CustomerRecordDependencies) => partyPatchHandler("customers", "customerId", {
  authenticate: dependencies.authenticate,
  ...(dependencies.update ? { update: async (input) => toPublicCustomer(await dependencies.update!(input as Parameters<NonNullable<CustomerRecordDependencies["update"]>>[0])) } : {}),
});
const unavailable: CustomerRecordDependencies = { authenticate: async () => null };
export const GET = createPartyGetHandler(unavailable);
export const PATCH = createPartyPatchHandler(unavailable);
