// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyCreateHandler, partyListHandler, type PartyCollectionDependencies } from "../../../modules/masters/party-route.ts";
export const createPartyListHandler = (dependencies: PartyCollectionDependencies) => partyListHandler("suppliers", dependencies);
export const createPartyCreateHandler = (dependencies: PartyCollectionDependencies) => partyCreateHandler("suppliers", dependencies);
const unavailable: PartyCollectionDependencies = { authenticate: async () => null };
export const GET = createPartyListHandler(unavailable);
export const POST = createPartyCreateHandler(unavailable);
