// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createExpenseMethods, createExpenseRuntime, expenseInternals, validateExpenseInput, type ExpenseApproval, type ExpenseCorrection, type ExpensePrincipal, type ExpenseRecord } from "./expense-service.ts";
import { randomUUID } from "node:crypto";

export function createInMemoryExpenseCorrectionService(options: Record<string, unknown>) {
  const runtime = createExpenseRuntime(options);
  const base = createExpenseMethods(runtime);
  const submitCorrection = async (input: Record<string, unknown>) => {
    const requester = input.principal as ExpensePrincipal | undefined;
    if (!requester || !requester.roles.some((role) => role === "OPERATIONS" || role === "OWNER_ADMIN")) expenseInternals.fail("PERMISSION_DENIED", 403);
    const operationKey = `submitApprovedExpenseCorrection:${requester!.userId}:${String(input.idempotencyKey)}`;
    return expenseInternals.result(runtime, operationKey, () => {
      const original = expenseInternals.current(runtime, input.expenseId, String(input.correlationId)); expenseInternals.expected(original, input.expectedVersion, String(input.correlationId));
      if (original.state !== "APPROVED") expenseInternals.fail("INVALID_STATE_TRANSITION", 409, String(input.correlationId));
      const reason = typeof input.reason === "string" ? input.reason.trim() : ""; const replacement = input.replacement;
      if (reason.length < 3 || !replacement || typeof replacement !== "object" || Array.isArray(replacement)) expenseInternals.fail("VALIDATION_FAILED", 400, String(input.correlationId));
      const replacementInput = { ...(replacement as Record<string, unknown>), projectId: original.projectId, correlationId: input.correlationId };
      validateExpenseInput(runtime, replacementInput, original.projectId);
      const correctionId = randomUUID();
      const correction: ExpenseCorrection = { id: correctionId, originalExpenseId: original.id, originalVersion: original.version, reason, replacement: expenseInternals.clone(replacement as Record<string, unknown>), subjectHash: expenseInternals.hash({ original: expenseInternals.expenseSnapshot(original), replacement, reason }), originalEvidenceId: original.evidenceId, replacementEvidenceId: String((replacement as Record<string, unknown>).evidenceId), approvalId: "", applied: false };
      const approval: ExpenseApproval = { id: randomUUID(), actionCode: "DIRECT_EXPENSE_CORRECTION", subjectId: original.id, subjectVersion: original.version, subjectHash: correction.subjectHash, requesterId: requester!.userId, decision: "PENDING", correctionId };
      correction.approvalId = approval.id; runtime.corrections.set(correction.id, correction); runtime.approvals.set(approval.id, approval); return { ...approval, correctionId };
    });
  };
  const decideApproval = async (input: Record<string, unknown>) => {
    const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
    if (!approval || approval.actionCode === "DIRECT_EXPENSE") return base.decideApproval(input);
    const approver = input.approver as ExpensePrincipal | undefined;
    if (approver?.userId === approval.requesterId) expenseInternals.fail("SELF_APPROVAL_FORBIDDEN", 409);
    if (!approver?.roles.includes("OWNER_ADMIN")) expenseInternals.fail("PERMISSION_DENIED", 403);
    if (approval.decision !== "PENDING") expenseInternals.fail("INVALID_STATE_TRANSITION", 409);
    const correction = runtime.corrections.get(approval!.correctionId!); const row = expenseInternals.current(runtime, approval.subjectId, randomUUID());
    if (!correction || row.version !== approval.subjectVersion || correction.subjectHash !== approval!.subjectHash) expenseInternals.fail("APPROVAL_VERSION_MISMATCH", 409);
    if (input.decision !== "APPROVED" && input.decision !== "REJECTED") expenseInternals.fail("VALIDATION_FAILED", 400);
    approval.decision = input.decision as "APPROVED" | "REJECTED"; return expenseInternals.frozen(approval);
  };
  const applyCorrection = async (input: Record<string, unknown>) => {
    const actor = input.principal as ExpensePrincipal | undefined;
    if (!actor || !actor.roles.some((role) => role === "OPERATIONS" || role === "OWNER_ADMIN")) expenseInternals.fail("PERMISSION_DENIED", 403);
    const operationKey = `applyApprovedExpenseCorrection:${actor!.userId}:${String(input.idempotencyKey)}`;
    return expenseInternals.result(runtime, operationKey, () => {
      const original = expenseInternals.current(runtime, input.expenseId, String(input.correlationId));
      if (original.state !== "APPROVED") expenseInternals.fail("INVALID_STATE_TRANSITION", 409, String(input.correlationId));
      expenseInternals.expected(original, input.expectedVersion, String(input.correlationId));
      const approval = typeof input.approvalId === "string" ? runtime.approvals.get(input.approvalId) : undefined;
      if (!approval || approval.actionCode !== "DIRECT_EXPENSE_CORRECTION" || approval.subjectId !== original.id) expenseInternals.fail("APPROVAL_VERSION_MISMATCH", 409, String(input.correlationId));
      if (approval!.decision !== "APPROVED") expenseInternals.fail("APPROVAL_REQUIRED", 409, String(input.correlationId));
      const correction = runtime.corrections.get(approval!.correctionId!);
      if (!correction || correction!.applied || correction.originalVersion !== original.version || correction.subjectHash !== approval!.subjectHash) expenseInternals.fail("APPROVAL_VERSION_MISMATCH", 409, String(input.correlationId));
      const replacement = correction!.replacement; const valid = validateExpenseInput(runtime, { ...replacement, projectId: original.projectId }, original.projectId);
      const next: ExpenseRecord = { id: randomUUID(), projectId: original.projectId, salesShipmentId: valid.shipmentId, vendorId: String(replacement.vendorId), categoryCode: String(replacement.categoryCode), amount: valid.amount, currency: String(replacement.currency), occurredOn: String(replacement.occurredOn), evidenceId: String(replacement.evidenceId), state: "APPROVED", version: 1, replacesExpenseId: original.id, replacedByExpenseId: null, cancellationReason: null };
      original.state = "CANCELLED"; original.replacedByExpenseId = next.id; original.cancellationReason = correction!.reason; original.version += 1; correction!.applied = true; runtime.expenses.set(next.id, next);
      const project = runtime.projects.get(original.projectId)!; project.finalState = "OPEN"; project.assessmentValid = false;
      runtime.audit.push({ action: "DIRECT_EXPENSE_CORRECTION_APPLIED", aggregateId: original.id, replacementExpenseId: next.id, occurredAt: runtime.now() });
      return { originalExpenseId: original.id, replacementExpenseId: next.id, correctionId: correction!.id };
    });
  };
  return {
    ...base, decideApproval, submitCorrection, applyCorrection,
    async getCorrection(correctionId: string) { const row = runtime.corrections.get(correctionId); if (!row) expenseInternals.fail("RESOURCE_NOT_FOUND", 404); return expenseInternals.frozen(row); },
    async auditTrail() { return Object.freeze(runtime.audit.map(expenseInternals.frozen)); },
  };
}
