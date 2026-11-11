// @ts-expect-error Native Node TypeScript tests require the source extension.
import { partyGetHandler, partyPatchHandler, type PartyRecordDependencies } from "../../../../modules/masters/party-route.ts";
export const createPartyGetHandler = (dependencies: PartyRecordDependencies) => partyGetHandler("customers", "customerId", dependencies);
export const createPartyPatchHandler = (dependencies: PartyRecordDependencies) => partyPatchHandler("customers", "customerId", dependencies);
const unavailable: PartyRecordDependencies = { authenticate: async () => null };
export const GET = createPartyGetHandler(unavailable);
export const PATCH = createPartyPatchHandler(unavailable);
