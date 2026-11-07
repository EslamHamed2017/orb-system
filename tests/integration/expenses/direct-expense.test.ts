import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000008001";
const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000008002";
const OTHER_PROJECT_ID = "019a5f9b-7c00-7000-8000-000000008003";
const VENDOR_ID = "019a5f9b-7c00-7000-8000-000000008004";
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000008005";
const OTHER_EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000008006";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008007", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008008", roles: ["OWNER_ADMIN"] });

type Result = { value: any; replayed: boolean };
interface ExpenseService {
  create(input: Record<string, unknown>): Promise<Result>;
  submitForApproval(input: Record<string, unknown>): Promise<Result>;
  decideApproval(input: Record<string, unknown>): Promise<any>;
  get(expenseId: string): Promise<any>;
  listProject(projectId: string): Promise<readonly any[]>;
  statement(projectId: string, currency: string): Promise<any>;
  margin(projectId: string, currency: string): Promise<any>;
  closure(projectId: string): Promise<any>;
}
interface ExpenseModule { createInMemoryExpenseService(options: Record<string, unknown>): ExpenseService }
async function subject(): Promise<ExpenseService> {
  const module = await import("../../../src/modules/expenses/expense-service.ts") as ExpenseModule;
  return module.createInMemoryExpenseService({
    now: () => "2026-11-07T16:00:00.000Z",
    projects: [
      { id: PROJECT_ID, version: 3, finalState: "FINAL_CLOSED" },
      { id: OTHER_PROJECT_ID, version: 1, finalState: "OPEN" },
    ],
    salesShipments: [{ id: SHIPMENT_ID, projectId: PROJECT_ID }],
    vendors: [{ id: VENDOR_ID, active: true }],
    categories: [{ code: "FREIGHT", active: true }],
    evidence: [
      { id: EVIDENCE_ID, projectId: PROJECT_ID, state: "AVAILABLE", sha256: "a".repeat(64) },
      { id: OTHER_EVIDENCE_ID, projectId: OTHER_PROJECT_ID, state: "AVAILABLE", sha256: "b".repeat(64) },
    ],
  });
}
const command = (key: string, principal = OPERATIONS) => ({ principal, idempotencyKey: key, correlationId: key });
const problem = (code: string, status?: number) => (error: unknown) => error instanceof ProblemError
  && error.problem.code === code && (status === undefined || error.problem.status === status);
function expense(scope: "PROJECT" | "SALES_SHIPMENT", key: string, overrides: Record<string, unknown> = {}) {
  return {
    projectId: PROJECT_ID, expectedVersion: 3, scope,
    ...(scope === "SALES_SHIPMENT" ? { salesShipmentId: SHIPMENT_ID } : {}),
    vendorId: VENDOR_ID, categoryCode: "FREIGHT", amount: "425.750000", currency: "USD",
    occurredOn: "2026-11-07", evidenceId: EVIDENCE_ID, ...overrides, ...command(key),
  };
}

async function approved(service: ExpenseService, scope: "PROJECT" | "SALES_SHIPMENT" = "PROJECT") {
  const draft = await service.create(expense(scope, `expense-${scope}-create`));
  const pending = await service.submitForApproval({ expenseId: draft.value.id, expectedVersion: draft.value.version, ...command(`expense-${scope}-submit`) });
  assert.deepEqual(
    { actionCode: pending.value.actionCode, subjectId: pending.value.subjectId, subjectVersion: pending.value.subjectVersion },
    { actionCode: "DIRECT_EXPENSE", subjectId: draft.value.id, subjectVersion: draft.value.version },
  );
  await assert.rejects(
    () => service.decideApproval({ approvalId: pending.value.id, approver: OPERATIONS, decision: "APPROVED" }),
    problem("SELF_APPROVAL_FORBIDDEN", 409),
  );
  await service.decideApproval({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED" });
  return service.get(draft.value.id);
}

test("creates proof-backed direct expenses at exactly one Project or one sales-shipment scope", async () => {
  const service = await subject();
  const project = await service.create(expense("PROJECT", "expense-project-create"));
  assert.equal(project.value.projectId, PROJECT_ID);
  assert.equal(project.value.salesShipmentId, null);
  assert.equal(project.value.evidenceId, EVIDENCE_ID);
  const shipment = await service.create(expense("SALES_SHIPMENT", "expense-shipment-create"));
  assert.equal(shipment.value.projectId, PROJECT_ID);
  assert.equal(shipment.value.salesShipmentId, SHIPMENT_ID);
  assert.equal(shipment.value.amount, "425.750000");
});

test("rejects absent, double, cross-Project and shared/multi-shipment scopes", async () => {
  const service = await subject();
  await assert.rejects(() => service.create(expense("PROJECT", "expense-project-with-shipment", { salesShipmentId: SHIPMENT_ID })), problem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.create(expense("SALES_SHIPMENT", "expense-shipment-missing", { salesShipmentId: undefined })), problem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.create(expense("SALES_SHIPMENT", "expense-cross-project", { projectId: OTHER_PROJECT_ID })), problem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.create(expense("PROJECT", "expense-shared", { salesShipmentIds: [SHIPMENT_ID] })), problem("VALIDATION_FAILED", 400));
  await assert.rejects(() => service.create(expense("PROJECT", "expense-wrong-proof", { evidenceId: OTHER_EVIDENCE_ID })), problem("VALIDATION_FAILED", 400));
});

test("Owner approval binds the exact expense version and immutable proof", async () => {
  const service = await subject();
  const row = await approved(service, "SALES_SHIPMENT");
  assert.equal(row.state, "APPROVED");
  assert.equal(row.evidenceId, EVIDENCE_ID);
  const snapshot = structuredClone(row);
  snapshot.amount = "0.000000";
  snapshot.evidenceId = OTHER_EVIDENCE_ID;
  assert.equal((await service.get(row.id)).amount, "425.750000");
  assert.equal((await service.get(row.id)).evidenceId, EVIDENCE_ID);
  await assert.rejects(
    () => service.submitForApproval({ expenseId: row.id, expectedVersion: row.version - 1, ...command("expense-stale-submit") }),
    problem("STALE_VERSION", 412),
  );
});

test("approved expense updates source-linked statements, margin and closure projections exactly", async () => {
  const service = await subject();
  const row = await approved(service);
  const statement = await service.statement(PROJECT_ID, "USD");
  assert.deepEqual(statement.lines.map((line: any) => ({ sourceType: line.sourceType, sourceId: line.sourceId, debit: line.debit })), [
    { sourceType: "DIRECT_EXPENSE", sourceId: row.id, debit: "425.750000" },
  ]);
  assert.equal(statement.balance, "425.750000");
  assert.equal((await service.margin(PROJECT_ID, "USD")).approvedExpenses, "425.750000");
  assert.equal((await service.closure(PROJECT_ID)).expensesComplete, true);
});

test("idempotent replay creates no duplicate expense or projection effect", async () => {
  const service = await subject();
  const input = expense("PROJECT", "expense-replay-create");
  const first = await service.create(input);
  const replay = await service.create(input);
  assert.equal(replay.replayed, true);
  assert.equal(replay.value.id, first.value.id);
  assert.equal((await service.listProject(PROJECT_ID)).length, 1);
});
