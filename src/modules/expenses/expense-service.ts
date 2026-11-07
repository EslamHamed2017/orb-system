import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { canonicalizeJson } from "../../platform/canonical-json/rfc8785.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { expenseClosure, expenseMargin, expenseStatement } from "./expense-query.ts";

export interface ExpensePrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface ExpenseRecord {
  id: string; projectId: string; salesShipmentId: string | null; vendorId: string; categoryCode: string;
  amount: string; currency: string; occurredOn: string; evidenceId: string; state: "DRAFT" | "APPROVED" | "CANCELLED";
  version: number; replacesExpenseId: string | null; replacedByExpenseId: string | null; cancellationReason: string | null;
}
export interface ExpenseApproval {
  id: string; actionCode: "DIRECT_EXPENSE" | "DIRECT_EXPENSE_CORRECTION"; subjectId: string; subjectVersion: number;
  subjectHash: string; requesterId: string; decision: "PENDING" | "APPROVED" | "REJECTED"; correctionId: string | null;
}
export interface ExpenseCorrection {
  id: string; originalExpenseId: string; originalVersion: number; reason: string; replacement: Record<string, unknown>;
  subjectHash: string; originalEvidenceId: string; replacementEvidenceId: string; approvalId: string; applied: boolean;
}
interface ProjectState { id: string; version: number; finalState: string; assessmentValid: boolean }
export interface ExpenseRuntime {
  now: () => string; projects: Map<string, ProjectState>; shipments: Map<string, string>; vendors: Set<string>; categories: Set<string>;
  evidence: Map<string, { projectId: string; state: string }>; expenses: Map<string, ExpenseRecord>;
  approvals: Map<string, ExpenseApproval>; corrections: Map<string, ExpenseCorrection>; idempotency: Map<string, unknown>; audit: Array<Record<string, unknown>>;
}

const clone = <T>(value: T): T => structuredClone(value);
const frozen = <T>(value: T): T => Object.freeze(clone(value));
const hash = (value: unknown) => createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function principal(input: Record<string, unknown>): ExpensePrincipal {
  const value = input.principal as ExpensePrincipal | undefined;
  if (!value || typeof value.userId !== "string" || !Array.isArray(value.roles) || !value.roles.some((role) => role === "OPERATIONS" || role === "OWNER_ADMIN")) fail("PERMISSION_DENIED", 403, String(input.correlationId ?? randomUUID()));
  return value;
}
function key(input: Record<string, unknown>, operation: string): string {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length === 0) fail("VALIDATION_FAILED", 400, String(input.correlationId ?? randomUUID()));
  return `${operation}:${(input.principal as ExpensePrincipal).userId}:${input.idempotencyKey}`;
}
function six(value: unknown): string {
  if (typeof value !== "string") fail("VALIDATION_FAILED", 400);
  try {
    const amount = DecimalAmount.parse(value);
    if (amount.scale > 6 || amount.isZero() || amount.isNegative()) fail("VALIDATION_FAILED", 400);
    const [whole, fraction = ""] = amount.toString().split(".");
    return `${whole}.${fraction.padEnd(6, "0")}`;
  } catch { fail("VALIDATION_FAILED", 400); }
}
function current(runtime: ExpenseRuntime, id: unknown, correlationId: string): ExpenseRecord {
  const row = typeof id === "string" ? runtime.expenses.get(id) : undefined;
  if (!row) fail("RESOURCE_NOT_FOUND", 404, correlationId);
  return row;
}
function expected(row: ExpenseRecord, value: unknown, correlationId: string) {
  if (!Number.isSafeInteger(value) || value !== row.version) fail("STALE_VERSION", 412, correlationId);
}
function expenseSnapshot(row: ExpenseRecord) {
  return { projectId: row.projectId, salesShipmentId: row.salesShipmentId, vendorId: row.vendorId, categoryCode: row.categoryCode,
    amount: row.amount, currency: row.currency, occurredOn: row.occurredOn, evidenceId: row.evidenceId, version: row.version };
}
export function createExpenseRuntime(options: Record<string, unknown>): ExpenseRuntime {
  const projects = new Map<string, ProjectState>();
  for (const item of (options.projects as Array<Record<string, unknown>> | undefined) ?? []) projects.set(String(item.id), { id: String(item.id), version: Number(item.version), finalState: String(item.finalState ?? "OPEN"), assessmentValid: item.closureAssessmentId !== undefined });
  return {
    now: typeof options.now === "function" ? options.now as () => string : () => new Date().toISOString(), projects,
    shipments: new Map(((options.salesShipments as Array<Record<string, unknown>> | undefined) ?? []).map((item) => [String(item.id), String(item.projectId)])),
    vendors: new Set(((options.vendors as Array<Record<string, unknown>> | undefined) ?? []).filter((item) => item.active).map((item) => String(item.id))),
    categories: new Set(((options.categories as Array<Record<string, unknown>> | undefined) ?? []).filter((item) => item.active).map((item) => String(item.code))),
    evidence: new Map(((options.evidence as Array<Record<string, unknown>> | undefined) ?? []).map((item) => [String(item.id), { projectId: String(item.projectId), state: String(item.state) }])),
    expenses: new Map(), approvals: new Map(), corrections: new Map(), idempotency: new Map(), audit: [],
  };
}
export function validateExpenseInput(runtime: ExpenseRuntime, input: Record<string, unknown>, inheritedProjectId?: string) {
  const projectId = inheritedProjectId ?? (typeof input.projectId === "string" ? input.projectId : "");
  const project = runtime.projects.get(projectId);
  const scope = input.scope;
  const shipmentId = typeof input.salesShipmentId === "string" ? input.salesShipmentId : null;
  const evidence = typeof input.evidenceId === "string" ? runtime.evidence.get(input.evidenceId) : undefined;
  const invalidScope = scope !== "PROJECT" && scope !== "SALES_SHIPMENT"
    || scope === "PROJECT" && shipmentId !== null
    || scope === "SALES_SHIPMENT" && (shipmentId === null || runtime.shipments.get(shipmentId) !== projectId)
    || Object.hasOwn(input, "salesShipmentIds");
  if (!project || invalidScope || !runtime.vendors.has(String(input.vendorId)) || !runtime.categories.has(String(input.categoryCode))
    || !evidence || evidence.projectId !== projectId || evidence.state !== "AVAILABLE"
    || typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)
    || typeof input.occurredOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) fail("VALIDATION_FAILED", 400, String(input.correlationId ?? randomUUID()));
  return { project, projectId, shipmentId, amount: six(input.amount) };
}
function result(runtime: ExpenseRuntime, idempotencyKey: string, create: () => unknown) {
  if (runtime.idempotency.has(idempotencyKey)) return Promise.resolve({ value: frozen(runtime.idempotency.get(idempotencyKey)), replayed: true });
  const value = create(); runtime.idempotency.set(idempotencyKey, clone(value)); return Promise.resolve({ value: frozen(value), replayed: false });
}
export function createExpenseMethods(runtime: ExpenseRuntime) {
  return {
    async create(input: Record<string, unknown>) {
      principal(input); const operationKey = key(input, "createDirectExpense");
      return result(runtime, operationKey, () => {
        const valid = validateExpenseInput(runtime, input); if (input.expectedVersion !== valid.project.version) fail("STALE_VERSION", 412, String(input.correlationId));
        const row: ExpenseRecord = { id: randomUUID(), projectId: valid.projectId, salesShipmentId: valid.shipmentId, vendorId: String(input.vendorId), categoryCode: String(input.categoryCode), amount: valid.amount, currency: String(input.currency), occurredOn: String(input.occurredOn), evidenceId: String(input.evidenceId), state: "DRAFT", version: 1, replacesExpenseId: null, replacedByExpenseId: null, cancellationReason: null };
        runtime.expenses.set(row.id, row); return row;
      });
    },
    async submitForApproval(input: Record<string, unknown>) {
      const requester = principal(input); const operationKey = key(input, "submitDirectExpense");
      return result(runtime, operationKey, () => {
        const row = current(runtime, input.expenseId, String(input.correlationId)); expected(row, input.expectedVersion, String(input.correlationId));
        if (row.state !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, String(input.correlationId));
        const approval: ExpenseApproval = { id: randomUUID(), actionCode: "DIRECT_EXPENSE", subjectId: row.id, subjectVersion: row.version, subjectHash: hash(expenseSnapshot(row)), requesterId: requester.userId, decision: "PENDING", correctionId: null };
        runtime.approvals.set(approval.id, approval); return approval;
      });
    },
    async decideApproval(input: Record<string, unknown>) {
      const approver = input.approver as ExpensePrincipal | undefined; const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404); if (approver?.userId === approval.requesterId) fail("SELF_APPROVAL_FORBIDDEN", 409);
      if (!approver?.roles.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403); if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409);
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED") fail("VALIDATION_FAILED", 400);
      approval.decision = input.decision; if (approval.actionCode === "DIRECT_EXPENSE" && input.decision === "APPROVED") { const row = current(runtime, approval.subjectId, randomUUID()); if (row.version !== approval.subjectVersion || hash(expenseSnapshot(row)) !== approval.subjectHash) fail("APPROVAL_VERSION_MISMATCH", 409); row.state = "APPROVED"; row.version += 1; }
      return frozen(approval);
    },
    async get(expenseId: string) { return frozen(current(runtime, expenseId, randomUUID())); },
    async listProject(projectId: string) { return Object.freeze([...runtime.expenses.values()].filter((row) => row.projectId === projectId).map(frozen)); },
    async statement(projectId: string, currency: string) { return expenseStatement([...runtime.expenses.values()], projectId, currency); },
    async margin(projectId: string, currency: string) { return expenseMargin([...runtime.expenses.values()], projectId, currency); },
    async closure(projectId: string) { const project = runtime.projects.get(projectId); if (!project) fail("RESOURCE_NOT_FOUND", 404); return expenseClosure(project); },
  };
}
export function createInMemoryExpenseService(options: Record<string, unknown>) { return createExpenseMethods(createExpenseRuntime(options)); }
export const expenseInternals = Object.freeze({ clone, frozen, hash, fail, current, expected, expenseSnapshot, result });
