// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "../../platform/http/problem.ts";

export const PILOT_ROLES = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"] as const;
export type PilotRole = typeof PILOT_ROLES[number];

const OPERATION_ROLES = Object.freeze({
  "getCurrentSession": ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"],
  "changeOwnPassword": ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"],
  "resetUserPassword": ["OWNER_ADMIN"],
  "createUser": ["OWNER_ADMIN"],
  "updateUser": ["OWNER_ADMIN"],
  "listRoles": ["OWNER_ADMIN"],
  "createRole": ["OWNER_ADMIN"],
  "replaceRolePermissions": ["OWNER_ADMIN"],
  "listPermissions": ["OWNER_ADMIN"],
  "getSettings": [
    "OWNER_ADMIN"
  ],
  "updateSettings": [
    "OWNER_ADMIN"
  ],
  "runOperationalReport": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "getAccountsSummary": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "listAccountRecords": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "listProductMovements": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listCustomers": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createCustomer": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getCustomer": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "updateCustomer": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listSuppliers": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createSupplier": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getSupplier": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "updateSupplier": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listProducts": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createProduct": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getProduct": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "updateProduct": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listMasterRecords": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createMasterRecord": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "updateMasterRecord": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listProjects": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createProjectWithSalesContract": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getProject": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createPurchaseContract": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "activateProject": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "createContractAmendment": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "submitContractForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "createSupplierShipment": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "submitSupplierShipmentConfirmation": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "confirmSupplierShipment": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "createSalesShipment": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "setPrimarySupplierSource": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "requestToleranceException": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "confirmSalesShipment": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getFixedRouteChecklist": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "updateRouteEvidenceOrMilestone": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "uploadEvidence": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listEvidence": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "getEvidenceMetadata": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "viewOrDownloadEvidence": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "generateShipmentDocument": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getDocumentGenerationStatus": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "reviseDocument": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "submitDocumentForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "cancelDocumentRevision": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "createOutboundManifest": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "submitOutboundManifestForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "sendApprovedOutboundManifest": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "cancelOutboundManifest": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listFixedApprovalInbox": [
    "OWNER_ADMIN"
  ],
  "decideFixedApproval": [
    "OWNER_ADMIN"
  ],
  "createSalesInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "getSalesInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "getSalesInvoicePrintData": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "createSupplierInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "submitSupplierInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "confirmSupplierInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "getProjectMoney": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "recordMoneyMovement": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "allocateMoneyMovement": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "reverseMoneyMovement": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "createDirectExpense": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "cancelDirectExpense": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "submitDirectExpense": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getOperationalStatement": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "getProjectMarginAndCash": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "listShipments": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "openSimpleClaim": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "moveClaimUnderReview": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "submitClaimOutcomeForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "assessProjectClosure": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "requestClosureException": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "finalCloseProject": [
    "OWNER_ADMIN"
  ],
  "submitFinalCloseForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "reopenProject": [
    "OWNER_ADMIN"
  ],
  "submitReopenForApproval": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listProjectAuditEvents": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listSupplierShipmentDatasetHistory": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "reviseSupplierShipmentDataset": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listSalesShipmentDatasetHistory": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "reviseSalesShipmentDataset": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "transitionSupplierShipmentExecution": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "transitionSalesShipmentExecution": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "reverseSettlementAllocation": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "submitApprovedExpenseCorrection": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "applyApprovedExpenseCorrection": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "cancelUnexecutedProject": [
    "OWNER_ADMIN"
  ],
  "applyApprovedClaimOutcome": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getOutboundManifestExactPreview": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "reviseOutboundManifest": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listOutboundSendAttempts": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "submitSalesShipmentConfirmation": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "cancelUnallocatedSupplierInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "cancelUnallocatedSalesInvoice": [
    "OWNER_ADMIN",
    "FINANCE_VIEWER"
  ],
  "signIn": [],
  "signOutCurrentSession": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listPilotUsers": [
    "OWNER_ADMIN"
  ],
  "assignFixedPilotRoles": [
    "OWNER_ADMIN"
  ],
  "revokePilotUserSession": [
    "OWNER_ADMIN"
  ],
  "getBackupRecoveryStatus": [
    "OWNER_ADMIN"
  ],
  "startIsolatedRestoreTest": [
    "OWNER_ADMIN"
  ],
  "getIsolatedRestoreTest": [
    "OWNER_ADMIN"
  ],
  "getSupplierShipmentWorkspace": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "getSupplierContainerConsolidation": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "getSalesShipmentWorkspace": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listPilotUserSessions": [
    "OWNER_ADMIN"
  ],
  "listSupplierShipmentLines": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createSupplierShipmentLine": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getSupplierShipmentLine": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listSalesShipmentLines": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createSalesShipmentLine": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getSalesShipmentLine": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "allocateShipmentLineSource": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getContractLineFulfillment": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "listContractLines": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "createContractLine": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "getContractLine": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ],
  "updateContractLine": [
    "OWNER_ADMIN",
    "OPERATIONS"
  ],
  "listContractLineVersions": [
    "OWNER_ADMIN",
    "OPERATIONS",
    "FINANCE_VIEWER"
  ]
}) as Readonly<Record<string, readonly PilotRole[]>>;

function deny(code: string, status: number, correlationId?: string): never {
  const detail = code === "REAUTHENTICATION_REQUIRED" ? "MFA reauthentication is required."
    : code === "SELF_APPROVAL_FORBIDDEN" ? "Self approval is forbidden."
    : "Permission is denied for this operation.";
  throw problemError({ code, status, detail, correlationId: correlationId?.trim() || crypto.randomUUID() });
}

export function operationIds(): readonly string[] {
  return Object.freeze(Object.keys(OPERATION_ROLES));
}

export function requiredRolesForOperation(operationId: string): readonly PilotRole[] {
  const roles = OPERATION_ROLES[operationId];
  if (!roles) throw new Error(`Unknown operation: ${operationId}`);
  return roles;
}

export function assertAuthorized(input: { actor: { userId: string; roles: readonly string[] }; operationId: string; correlationId?: string }): void {
  const required = requiredRolesForOperation(input.operationId);
  if (required.length === 0) return;
  if (!input.actor.roles.some((role) => required.includes(role as PilotRole))) deny("PERMISSION_DENIED", 403, input.correlationId);
}

const OPERATIONS_HIDDEN_FIELDS = new Set(["supplierCost", "expectedMargin", "actualMargin", "margin", "profit"]);
export function shapeSensitiveFields(record: Record<string, unknown>, roles: readonly string[]): Record<string, unknown> {
  const mayReadFinance = roles.includes("OWNER_ADMIN") || roles.includes("FINANCE_VIEWER");
  return Object.fromEntries(Object.entries(record).filter(([key]) => mayReadFinance || !OPERATIONS_HIDDEN_FIELDS.has(key)));
}

export function assertOwnerMfa(input: { roles: readonly string[]; mfaSatisfiedAt: string | null; now: string; correlationId?: string }): void {
  if (!input.roles.includes("OWNER_ADMIN")) deny("PERMISSION_DENIED", 403, input.correlationId);
  const now = Date.parse(input.now), satisfied = input.mfaSatisfiedAt === null ? Number.NaN : Date.parse(input.mfaSatisfiedAt);
  if (!Number.isFinite(now) || !Number.isFinite(satisfied) || satisfied > now || now - satisfied > 15 * 60_000) deny("REAUTHENTICATION_REQUIRED", 401, input.correlationId);
}

export function assertDifferentApprover(requesterId: string, approverId: string, correlationId?: string): void {
  if (requesterId === approverId) deny("SELF_APPROVAL_FORBIDDEN", 409, correlationId);
}
