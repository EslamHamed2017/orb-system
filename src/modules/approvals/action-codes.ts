export const APPROVAL_ACTION_CODES = Object.freeze([
  "CONTRACT_VERSION",
  "SUPPLIER_SHIPMENT_CONFIRMATION",
  "SALES_SHIPMENT_CONFIRMATION",
  "TOLERANCE_EXCEPTION",
  "SUPPLIER_INVOICE_CONFIRMATION",
  "DIRECT_EXPENSE",
  "EXPENSE_CORRECTION",
  "DOCUMENT_OUTPUT",
  "EXTERNAL_SEND",
  "CLAIM_OUTCOME",
  "CLOSURE_EXCEPTION",
  "FINAL_CLOSE",
  "REOPEN",
] as const);

export type ApprovalActionCode = (typeof APPROVAL_ACTION_CODES)[number];
export type FixedApprovalRule = Readonly<{
  requesterRoles: readonly string[];
  approverRole: "OWNER_ADMIN";
  subjectType: string;
}>;

function rule(requesterRoles: readonly string[], subjectType: string): FixedApprovalRule {
  return Object.freeze({ requesterRoles: Object.freeze([...requesterRoles]), approverRole: "OWNER_ADMIN", subjectType });
}

export const FIXED_APPROVAL_MATRIX: Readonly<Record<ApprovalActionCode, FixedApprovalRule>> = Object.freeze({
  CONTRACT_VERSION: rule(["OPERATIONS"], "CONTRACT_VERSION"),
  SUPPLIER_SHIPMENT_CONFIRMATION: rule(["OPERATIONS"], "SUPPLIER_SHIPMENT_DATASET"),
  SALES_SHIPMENT_CONFIRMATION: rule(["OPERATIONS"], "SALES_SHIPMENT_DATASET"),
  TOLERANCE_EXCEPTION: rule(["OPERATIONS"], "TOLERANCE_EXCEPTION"),
  SUPPLIER_INVOICE_CONFIRMATION: rule(["FINANCE_VIEWER"], "SUPPLIER_INVOICE"),
  DIRECT_EXPENSE: rule(["OPERATIONS"], "DIRECT_EXPENSE"),
  EXPENSE_CORRECTION: rule(["OPERATIONS"], "EXPENSE_CORRECTION"),
  DOCUMENT_OUTPUT: rule(["OPERATIONS"], "DOCUMENT_REVISION"),
  EXTERNAL_SEND: rule(["OPERATIONS"], "OUTBOUND_MANIFEST"),
  CLAIM_OUTCOME: rule(["OPERATIONS"], "CLAIM_OUTCOME_PROPOSAL"),
  CLOSURE_EXCEPTION: rule(["OPERATIONS", "FINANCE_VIEWER"], "CLOSURE_ASSESSMENT"),
  FINAL_CLOSE: rule(["OPERATIONS", "FINANCE_VIEWER"], "PROJECT"),
  REOPEN: rule(["OPERATIONS", "FINANCE_VIEWER"], "PROJECT"),
});

export function isApprovalActionCode(value: unknown): value is ApprovalActionCode {
  return typeof value === "string" && (APPROVAL_ACTION_CODES as readonly string[]).includes(value);
}
