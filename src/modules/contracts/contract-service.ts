export { validateContractInput, validateAmendment, ZERO_CONTRACT_TOLERANCES } from "./schemas";

export type ContractKind = "SALES" | "PURCHASE";
export type ContractVersionState = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";
