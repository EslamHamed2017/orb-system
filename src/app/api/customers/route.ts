// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyCollectionDependencies, type PartyPrincipal } from "../../../modules/masters/party-route.ts";
import type { CustomerRecord } from "../../../modules/customers/customer-service.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { toPublicCustomer } from "../../../modules/customers/customer-response.ts";

export interface CustomerCollectionDependencies {
  readonly authenticate: PartyCollectionDependencies["authenticate"];
  readonly list?: (input: { request: Request; masterType: "customers"; principal: PartyPrincipal }) => Promise<readonly CustomerRecord[]>;
  readonly create?: (input: { request: Request; masterType: "customers"; principal: PartyPrincipal }) => Promise<CustomerRecord>;
}
export const createPartyListHandler = (dependencies: CustomerCollectionDependencies) => partyListHandler("customers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.list ? { list: async (input) => (await dependencies.list!(input as Parameters<NonNullable<CustomerCollectionDependencies["list"]>>[0])).map(toPublicCustomer) } : {}),
});
export const createPartyCreateHandler = (dependencies: CustomerCollectionDependencies) => partyCreateHandler("customers", {
  authenticate: dependencies.authenticate,
  ...(dependencies.create ? { create: async (input) => toPublicCustomer(await dependencies.create!(input as Parameters<NonNullable<CustomerCollectionDependencies["create"]>>[0])) } : {}),
});
const unavailable: CustomerCollectionDependencies = { authenticate: async () => null };
export const GET = createPartyListHandler(unavailable);
export const POST = createPartyCreateHandler(unavailable);
