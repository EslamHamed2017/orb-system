import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { CLOSURE_BLOCKER_CODES, isClosureExceptionEligible, type ClosureBlockerCode } from "./blocker-codes.ts";

export interface ClosureBlocker {
  id: string; code: ClosureBlockerCode; subjectType: string; subjectId: string;
  exceptionEligible: boolean; coveredByApprovalId: string | null;
}
export interface ClosureAssessment {
  id: string; projectId: string; projectVersion: number; assessedAt: string; blockersHash: string;
  blockers: ClosureBlocker[]; state: "CURRENT" | "INVALIDATED";
}
export interface ClosureBasis {
  project: { id: string; version: number };
  salesShipments: Array<Record<string, unknown>>; supplierShipments: Array<Record<string, unknown>>;
  supplierInvoices: Array<Record<string, unknown>>; routeItems: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>; customerInvoiceBalances: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>; claims: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>; integrityFindings: Array<Record<string, unknown>>;
  securityFindings: Array<Record<string, unknown>>;
  shipmentFinancialState: (shipmentId: string) => "OPEN" | "FINANCIALLY_CLOSED";
}

function firstByCode(blockers: ClosureBlocker[], code: ClosureBlockerCode, subjectType: string, subjectId: string) {
  if (!blockers.some((item) => item.code === code)) blockers.push({ id: randomUUID(), code, subjectType, subjectId,
    exceptionEligible: isClosureExceptionEligible(code), coveredByApprovalId: null });
}
function active(row: Record<string, unknown>) { return row.cancelled !== true && row.executionState !== "CANCELLED"; }
function approvedDocument(documents: Array<Record<string, unknown>>, shipmentId: string, type: string) {
  return documents.some((item) => item.salesShipmentId === shipmentId && item.type === type && item.state === "APPROVED" && item.cancelled !== true);
}
function nonzero(value: unknown) { return typeof value === "string" && !/^[-+]?0+(?:\.0+)?$/.test(value); }

export function buildClosureAssessment(basis: ClosureBasis, assessedAt: string): ClosureAssessment {
  const blockers: ClosureBlocker[] = [];
  const sales = basis.salesShipments.filter((item) => item.projectId === basis.project.id && active(item));
  for (const shipment of sales) {
    const id = String(shipment.id);
    if (shipment.executionState !== "DELIVERED") firstByCode(blockers, CLOSURE_BLOCKER_CODES.SALES_SHIPMENT_NOT_DELIVERED, "SALES_SHIPMENT", id);
    if (basis.shipmentFinancialState(id) !== "FINANCIALLY_CLOSED") firstByCode(blockers, CLOSURE_BLOCKER_CODES.SALES_SHIPMENT_NOT_FINANCIALLY_CLOSED, "SALES_SHIPMENT", id);
    if (!approvedDocument(basis.documents, id, "CINV")) firstByCode(blockers, CLOSURE_BLOCKER_CODES.CINV_MISSING, "SALES_SHIPMENT", id);
    if (!approvedDocument(basis.documents, id, "PACKING_LIST")) firstByCode(blockers, CLOSURE_BLOCKER_CODES.PACKING_LIST_MISSING, "SALES_SHIPMENT", id);
    const cinvs = basis.documents.filter((item) => item.salesShipmentId === id && item.type === "CINV" && item.state === "APPROVED" && item.cancelled !== true);
    if (cinvs.some((doc) => basis.customerInvoiceBalances.some((balance) => balance.documentId === doc.id && nonzero(balance.outstanding))))
      firstByCode(blockers, CLOSURE_BLOCKER_CODES.CUSTOMER_BALANCE_OUTSTANDING, "SALES_SHIPMENT", id);
  }
  const suppliers = basis.supplierShipments.filter((item) => item.projectId === basis.project.id && active(item));
  for (const shipment of suppliers) {
    const id = String(shipment.id);
    if (shipment.executionState !== "RECEIVED") firstByCode(blockers, CLOSURE_BLOCKER_CODES.SUPPLIER_SHIPMENT_NOT_RECEIVED, "SUPPLIER_SHIPMENT", id);
    const invoices = basis.supplierInvoices.filter((item) => item.supplierShipmentId === id && item.state === "CONFIRMED" && item.cancelled !== true);
    if (invoices.length === 0) firstByCode(blockers, CLOSURE_BLOCKER_CODES.SUPPLIER_INVOICE_MISSING, "SUPPLIER_SHIPMENT", id);
    if (invoices.some((item) => nonzero(item.outstanding))) firstByCode(blockers, CLOSURE_BLOCKER_CODES.SUPPLIER_BALANCE_OUTSTANDING, "SUPPLIER_SHIPMENT", id);
  }
  for (const item of basis.routeItems) if (sales.some((shipment) => shipment.id === item.salesShipmentId) && item.state !== "SATISFIED")
    firstByCode(blockers, CLOSURE_BLOCKER_CODES.ROUTE_ITEM_INCOMPLETE, "ROUTE_ITEM", String(item.id));
  for (const item of basis.expenses) if (item.projectId === basis.project.id && item.state !== "APPROVED" && item.state !== "CANCELLED_REPLACED")
    firstByCode(blockers, CLOSURE_BLOCKER_CODES.EXPENSE_INCOMPLETE, "EXPENSE", String(item.id));
  for (const item of basis.claims) if (item.projectId === basis.project.id && (!new Set(["RESOLVED", "REJECTED"]).has(String(item.state)) || item.outcomeApplied !== true))
    firstByCode(blockers, CLOSURE_BLOCKER_CODES.CLAIM_INCOMPLETE, "CLAIM", String(item.id));
  for (const item of basis.approvals) if (item.projectId === basis.project.id && item.current !== false && item.decision !== "APPROVED") {
    const code = item.versionStale === true ? CLOSURE_BLOCKER_CODES.APPROVAL_VERSION_STALE
      : item.decision === "REJECTED" ? CLOSURE_BLOCKER_CODES.APPROVAL_REJECTED
      : item.decision === "EXPIRED" ? CLOSURE_BLOCKER_CODES.APPROVAL_EXPIRED : CLOSURE_BLOCKER_CODES.APPROVAL_PENDING;
    firstByCode(blockers, code, "APPROVAL", String(item.id));
  }
  for (const item of basis.integrityFindings) if (item.projectId === basis.project.id)
    firstByCode(blockers, CLOSURE_BLOCKER_CODES.AUDIT_INTEGRITY_FAILED, "INTEGRITY_FINDING", String(item.id));
  for (const item of basis.securityFindings) if (item.projectId === basis.project.id)
    firstByCode(blockers, CLOSURE_BLOCKER_CODES.SECURITY_CONTROL_FAILED, "SECURITY_FINDING", String(item.id));
  const hashInput = blockers.map(({ code, subjectType, subjectId, exceptionEligible }) => ({ code, subjectType, subjectId, exceptionEligible }));
  return { id: randomUUID(), projectId: basis.project.id, projectVersion: basis.project.version, assessedAt,
    blockersHash: createHash("sha256").update(JSON.stringify(hashInput)).digest("hex"), blockers, state: "CURRENT" };
}

export function assessmentSnapshot(assessment: ClosureAssessment) {
  const blockers = Object.freeze(assessment.blockers.map((item) => Object.freeze(structuredClone(item))));
  return Object.freeze({ id: assessment.id, projectId: assessment.projectId, projectVersion: assessment.projectVersion,
    assessedAt: assessment.assessedAt, blockersHash: assessment.blockersHash, blockers,
    ...(assessment.state === "INVALIDATED" ? { state: assessment.state } : {}) });
}
