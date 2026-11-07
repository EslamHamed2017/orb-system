import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a6000-1000-7000-8000-000000000001";
const SALES_ID = "019a6000-1000-7000-8000-000000000002";
const SUPPLIER_ID = "019a6000-1000-7000-8000-000000000003";
const OWNER = Object.freeze({ userId: "019a6000-1000-7000-8000-000000000004", roles: ["OWNER_ADMIN"] });
const OPERATIONS = Object.freeze({ userId: "019a6000-1000-7000-8000-000000000005", roles: ["OPERATIONS"] });

type Blocker = { id: string; code: string; subjectType: string; subjectId: string; exceptionEligible: boolean; coveredByApprovalId: string | null };
type Assessment = { id: string; projectId: string; projectVersion: number; assessedAt: string; blockersHash: string; blockers: readonly Blocker[] };
type Result<T = any> = { value: T; replayed: boolean };
interface ClosureService {
  assess(input: Record<string, unknown>): Promise<Result<Assessment>>;
  requestException(input: Record<string, unknown>): Promise<Result>;
  decideApproval(input: Record<string, unknown>): Promise<any>;
  submitFinalClose(input: Record<string, unknown>): Promise<Result>;
  finalClose(input: Record<string, unknown>): Promise<Result>;
  invalidate(input: Record<string, unknown>): Promise<any>;
  assessment(id: string): Promise<any>;
  project(id: string): Promise<any>;
}
interface ClosureModule { createInMemoryClosureService(options: Record<string, unknown>): ClosureService }

const complete = Object.freeze({
  salesShipments: [{ id: SALES_ID, projectId: PROJECT_ID, executionState: "DELIVERED" }],
  supplierShipments: [{ id: SUPPLIER_ID, projectId: PROJECT_ID, executionState: "RECEIVED" }],
  supplierInvoices: [{ id: "supplier-invoice", supplierShipmentId: SUPPLIER_ID, state: "CONFIRMED", cancelled: false, outstanding: "0.000000" }],
  routeItems: [{ id: "route-item", salesShipmentId: SALES_ID, state: "SATISFIED" }],
  documents: [
    { id: "cinv", projectId: PROJECT_ID, salesShipmentId: SALES_ID, type: "CINV", state: "APPROVED", cancelled: false },
    { id: "packing", projectId: PROJECT_ID, salesShipmentId: SALES_ID, type: "PACKING_LIST", state: "APPROVED", cancelled: false },
  ],
  customerInvoiceBalances: [{ documentId: "cinv", outstanding: "0.000000" }],
  expenses: [{ id: "expense", projectId: PROJECT_ID, state: "APPROVED" }],
  claims: [{ id: "claim", projectId: PROJECT_ID, state: "RESOLVED", outcomeApplied: true }],
  approvals: [], integrityFindings: [], securityFindings: [],
});
async function subject(overrides: Record<string, unknown> = {}): Promise<ClosureService> {
  const modulePath = "../../../src/modules/closure/closure-service.ts";
  const module = await import(modulePath) as ClosureModule;
  return module.createInMemoryClosureService({
    now: () => "2026-11-07T20:00:00.000Z",
    projects: [{ id: PROJECT_ID, version: 20, state: "FINANCIALLY_CLOSED", assessmentValid: false }],
    ...complete, ...overrides,
  });
}
const command = (key: string, principal: any = OPERATIONS) => ({ principal, idempotencyKey: key, correlationId: key });
const problem = (code: string, status?: number) => (error: unknown) => error instanceof ProblemError
  && error.problem.code === code && (status === undefined || error.problem.status === status);

async function assess(service: ClosureService, key = "assessment") {
  return (await service.assess({ projectId: PROJECT_ID, expectedVersion: 20, ...command(key) })).value;
}

test("complete reachable state produces an immutable versioned assessment with no blockers", async () => {
  const service = await subject();
  const assessment = await assess(service);
  assert.equal(assessment.projectId, PROJECT_ID);
  assert.equal(assessment.projectVersion, 20);
  assert.equal(assessment.assessedAt, "2026-11-07T20:00:00.000Z");
  assert.match(assessment.blockersHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(assessment.blockers, []);
  assert.deepEqual(await service.assessment(assessment.id), assessment);
  assert.throws(() => { (assessment.blockers as Blocker[]).push({} as Blocker); }, TypeError);
});

test("assessment returns every reachable blocker instead of stopping at the first", async () => {
  const service = await subject({
    salesShipments: [{ id: SALES_ID, projectId: PROJECT_ID, executionState: "IN_TRANSIT" }],
    supplierShipments: [{ id: SUPPLIER_ID, projectId: PROJECT_ID, executionState: "IN_TRANSIT" }],
    supplierInvoices: [], routeItems: [{ id: "route-item", salesShipmentId: SALES_ID, state: "IN_PROGRESS" }],
    documents: [], customerInvoiceBalances: [], expenses: [{ id: "expense", projectId: PROJECT_ID, state: "PENDING_APPROVAL" }],
    claims: [{ id: "claim", projectId: PROJECT_ID, state: "UNDER_REVIEW", outcomeApplied: false }],
    approvals: [{ id: "approval", projectId: PROJECT_ID, decision: "PENDING", current: true }],
    integrityFindings: [{ id: "audit-gap", projectId: PROJECT_ID, kind: "AUDIT_CHAIN_INVALID" }],
    securityFindings: [{ id: "auth-gap", projectId: PROJECT_ID, kind: "SECURITY_CONTROL_FAILED" }],
  });
  const assessment = await assess(service, "all-blockers");
  const codes = assessment.blockers.map((item) => item.code);
  for (const code of ["SALES_SHIPMENT_NOT_DELIVERED", "SALES_SHIPMENT_NOT_FINANCIALLY_CLOSED", "SUPPLIER_SHIPMENT_NOT_RECEIVED",
    "SUPPLIER_INVOICE_MISSING", "ROUTE_ITEM_INCOMPLETE", "CINV_MISSING", "PACKING_LIST_MISSING", "EXPENSE_INCOMPLETE",
    "CLAIM_INCOMPLETE", "APPROVAL_PENDING", "AUDIT_INTEGRITY_FAILED", "SECURITY_CONTROL_FAILED"])
    assert.ok(codes.includes(code), `missing blocker ${code}`);
  assert.equal(new Set(codes).size, codes.length);
});

test("only named operational blockers are exception eligible; balance, integrity, approval and security blockers never are", async () => {
  const service = await subject({
    customerInvoiceBalances: [{ documentId: "cinv", outstanding: "1.000000" }],
    routeItems: [{ id: "route-item", salesShipmentId: SALES_ID, state: "IN_PROGRESS" }],
    approvals: [{ id: "approval", projectId: PROJECT_ID, decision: "PENDING", current: true }],
    integrityFindings: [{ id: "audit-gap", projectId: PROJECT_ID, kind: "AUDIT_CHAIN_INVALID" }],
    securityFindings: [{ id: "auth-gap", projectId: PROJECT_ID, kind: "SECURITY_CONTROL_FAILED" }],
  });
  const assessment = await assess(service, "eligibility");
  assert.equal(assessment.blockers.find((item) => item.code === "ROUTE_ITEM_INCOMPLETE")?.exceptionEligible, true);
  for (const code of ["CUSTOMER_BALANCE_OUTSTANDING", "APPROVAL_PENDING", "AUDIT_INTEGRITY_FAILED", "SECURITY_CONTROL_FAILED"])
    assert.equal(assessment.blockers.find((item) => item.code === code)?.exceptionEligible, false, code);
  const forbidden = assessment.blockers.find((item) => item.code === "CUSTOMER_BALANCE_OUTSTANDING")!;
  await assert.rejects(() => service.requestException({ projectId: PROJECT_ID, expectedVersion: 20,
    assessmentId: assessment.id, blockerIds: [forbidden.id], reason: "Attempt to waive balance", ...command("waive-balance") }),
  problem("CLOSURE_BLOCKED", 409));
});

test("exception approval binds exact assessment, Project version, blockers and reason", async () => {
  const service = await subject({ routeItems: [{ id: "route-item", salesShipmentId: SALES_ID, state: "IN_PROGRESS" }] });
  const assessment = await assess(service, "exception-assessment");
  const blocker = assessment.blockers.find((item) => item.code === "ROUTE_ITEM_INCOMPLETE")!;
  const pending = (await service.requestException({ projectId: PROJECT_ID, expectedVersion: 20, assessmentId: assessment.id,
    blockerIds: [blocker.id], reason: "Port evidence delayed", ...command("exception-request") })).value;
  assert.deepEqual({ actionCode: pending.actionCode, subjectType: pending.subjectType, subjectVersion: pending.subjectVersion },
    { actionCode: "CLOSURE_EXCEPTION", subjectType: "CLOSURE_ASSESSMENT", subjectVersion: 20 });
  assert.match(pending.subjectHash, /^[a-f0-9]{64}$/);
  await assert.rejects(() => service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OPERATIONS, decision: "APPROVED", comment: "Self approval" }), problem("SELF_APPROVAL_FORBIDDEN", 409));
  const approved = await service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OWNER, decision: "APPROVED", comment: "Named exception accepted" });
  assert.equal(approved.decision, "APPROVED");
  assert.equal((await service.assessment(assessment.id)).blockers[0].coveredByApprovalId, approved.id);
});

test("pending, rejected, expired, mismatched or stale approval cannot authorize final close", async () => {
  const service = await subject();
  const assessment = await assess(service, "close-assessment");
  const pending = (await service.submitFinalClose({ projectId: PROJECT_ID, expectedVersion: 20,
    assessmentId: assessment.id, ...command("close-submit") })).value;
  await assert.rejects(() => service.finalClose({ projectId: PROJECT_ID, expectedVersion: 20,
    assessmentId: assessment.id, approvalId: pending.id, ...command("close-pending", OWNER) }), problem("APPROVAL_REQUIRED", 409));
  await assert.rejects(() => service.finalClose({ projectId: PROJECT_ID, expectedVersion: 21,
    assessmentId: assessment.id, approvalId: pending.id, ...command("close-stale", OWNER) }), problem("STALE_VERSION", 412));
  await assert.rejects(() => service.finalClose({ projectId: PROJECT_ID, expectedVersion: 20,
    assessmentId: assessment.id, approvalId: "019a6000-1000-7000-8000-000000000099", ...command("close-mismatch", OWNER) }),
  problem("APPROVAL_VERSION_MISMATCH", 409));
});

test("every assessed-basis invalidator atomically stales assessment/exceptions and reopens Final Close", async () => {
  const invalidators = ["ALLOCATION_REVERSAL", "MONEY_MOVEMENT_REVERSAL", "CUSTOMER_REFUND", "SHIPMENT_CANCELLED", "SHIPMENT_REJECTED",
    "DOCUMENT_CANCELLED", "DOCUMENT_REVISED", "EXPENSE_CORRECTED", "CLAIM_OPENED", "CLAIM_REOPENED"];
  for (const kind of invalidators) {
    const service = await subject({ projects: [{ id: PROJECT_ID, version: 20, state: "FINAL_CLOSED", assessmentValid: false }] });
    const assessment = await assess(service, `assess-${kind}`);
    await service.invalidate({ projectId: PROJECT_ID, kind, subjectId: SALES_ID, reason: `Basis changed: ${kind}` });
    assert.equal((await service.assessment(assessment.id)).state, "INVALIDATED", kind);
    const project = await service.project(PROJECT_ID);
    assert.equal(project.finalState, "OPEN", kind);
    assert.equal(project.assessmentValid, false, kind);
  }
});
