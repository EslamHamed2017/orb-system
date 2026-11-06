import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

type Principal = Readonly<{ userId: string; displayName?: string; roles: readonly string[] }>;
type Field = "quantity" | "netWeight" | "grossWeight";
export interface ToleranceBreach { readonly field: Field; readonly allowedLower: string; readonly allowedUpper: string; readonly actual: string; readonly datasetVersion: number }
export interface ToleranceEvaluation { readonly withinTolerance: boolean; readonly breaches: readonly ToleranceBreach[]; readonly bindingHash: string; readonly datasetId: string; readonly sourceId: string }
interface ExceptionApproval { readonly id: string; readonly actionCode: "TOLERANCE_EXCEPTION"; readonly subjectId: string; readonly subjectVersion: number; readonly subjectHash: string; readonly datasetId: string; readonly sourceId: string; readonly reason: string; readonly breachedFields: readonly Field[]; readonly requester: Principal; readonly decision: "PENDING" | "APPROVED" | "REJECTED"; readonly version: number; readonly requestedAt: string; readonly approverId?: string; readonly decidedAt?: string; readonly comment?: string }

const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function render(value: DecimalAmount, scale: number): string { const [whole, fraction = ""] = value.toString().split("."); return scale ? `${whole}.${fraction.padEnd(scale, "0")}` : whole; }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", 400); return value as Record<string, unknown>; }

export function evaluateShipmentTolerance(input: Record<string, unknown>): ToleranceEvaluation {
  const contracted = record(input.contracted), actual = record(input.actual), tolerances = record(input.tolerances);
  const datasetVersion = input.datasetVersion;
  if (typeof input.datasetId !== "string" || typeof input.sourceId !== "string" || !Number.isSafeInteger(datasetVersion) || Number(datasetVersion) < 1) fail("VALIDATION_FAILED", 400);
  const definitions: readonly [Field, string, string][] = [["quantity", "quantityUnder", "quantityOver"], ["netWeight", "netWeightUnder", "netWeightOver"], ["grossWeight", "grossWeightUnder", "grossWeightOver"]];
  const breaches: ToleranceBreach[] = [];
  for (const [field, underKey, overKey] of definitions) {
    try {
      const expected = DecimalAmount.parse(String(contracted[field])), observed = DecimalAmount.parse(String(actual[field]));
      const under = DecimalAmount.parse(String(tolerances[underKey] ?? "0")), over = DecimalAmount.parse(String(tolerances[overKey] ?? "0"));
      if (expected.isNegative() || observed.isNegative() || under.isNegative() || over.isNegative()) fail("VALIDATION_FAILED", 400);
      const lower = expected.subtract(under), upper = expected.add(over);
      if (observed.compare(lower) < 0 || observed.compare(upper) > 0) {
        const scale = Math.max(String(contracted[field]).split(".")[1]?.length ?? 0, String(actual[field]).split(".")[1]?.length ?? 0, String(tolerances[underKey] ?? "0").split(".")[1]?.length ?? 0, String(tolerances[overKey] ?? "0").split(".")[1]?.length ?? 0);
        breaches.push(Object.freeze({ field, allowedLower: render(lower, scale), allowedUpper: render(upper, scale), actual: render(observed, scale), datasetVersion: Number(datasetVersion) }));
      }
    } catch (error) { if (error instanceof Error && error.name === "ProblemError") throw error; fail("VALIDATION_FAILED", 400); }
  }
  const binding = { datasetId: input.datasetId, datasetVersion, sourceId: input.sourceId, breaches };
  return Object.freeze({ withinTolerance: breaches.length === 0, breaches: Object.freeze(breaches), bindingHash: digest(binding), datasetId: input.datasetId, sourceId: input.sourceId }) as ToleranceEvaluation;
}

export function createInMemoryToleranceExceptionService(options: { now: () => string }) {
  const approvals = new Map<string, ExceptionApproval>(), replays = new Map<string, { hash: string; value: ExceptionApproval }>();
  return {
    async requestException(input: Record<string, unknown>) {
      const evaluation = input.evaluation as ToleranceEvaluation, principal = input.principal as Principal;
      const correlationId = typeof input.correlationId === "string" ? input.correlationId : randomUUID();
      if (!evaluation || evaluation.withinTolerance || !Array.isArray(evaluation.breaches) || typeof input.reason !== "string" || input.reason.trim().length < 3 || !Array.isArray(input.breachedFields) || !principal?.roles?.includes("OPERATIONS")) fail("VALIDATION_FAILED", 400, correlationId);
      const fields = evaluation.breaches.map((row) => row.field), supplied = input.breachedFields as string[];
      if (supplied.length !== fields.length || supplied.some((field, index) => field !== fields[index])) fail("VALIDATION_FAILED", 400, correlationId);
      const request = { bindingHash: evaluation.bindingHash, reason: input.reason, breachedFields: supplied };
      const scope = `${principal.userId}:${String(input.idempotencyKey)}`, hash = digest(request), prior = replays.get(scope);
      if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, correlationId); return { value: clone(prior.value), replayed: true }; }
      const approval: ExceptionApproval = Object.freeze({ id: randomUUID(), actionCode: "TOLERANCE_EXCEPTION", subjectId: evaluation.datasetId, subjectVersion: evaluation.breaches[0]!.datasetVersion, subjectHash: evaluation.bindingHash, datasetId: evaluation.datasetId, sourceId: evaluation.sourceId, reason: input.reason, breachedFields: Object.freeze([...fields]), requester: Object.freeze(clone(principal)), decision: "PENDING", version: 1, requestedAt: options.now() });
      approvals.set(approval.id, approval); replays.set(scope, { hash, value: approval }); return { value: clone(approval), replayed: false };
    },
    async applyDecision(input: Record<string, unknown>) {
      const approval = approvals.get(String(input.approvalId)), approver = input.approver as Principal;
      if (!approval) fail("RESOURCE_NOT_FOUND", 404); if (!approver?.roles?.includes("OWNER_ADMIN")) fail("PERMISSION_DENIED", 403); if (approver.userId === approval.requester.userId) fail("SELF_APPROVAL_FORBIDDEN", 409); if (approval.decision !== "PENDING") fail("INVALID_STATE_TRANSITION", 409);
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED") fail("VALIDATION_FAILED", 400);
      const next = Object.freeze({ ...approval, decision: input.decision, version: 2, approverId: approver.userId, decidedAt: options.now(), comment: String(input.comment ?? "") }) as ExceptionApproval; approvals.set(next.id, next); return clone(next);
    },
    async assertConfirmationAllowed(input: Record<string, unknown>) {
      const evaluation = input.evaluation as ToleranceEvaluation; if (evaluation.withinTolerance) return;
      const approval = approvals.get(String(input.approvalId));
      if (!approval || approval.decision !== "APPROVED") fail("OUTSIDE_TOLERANCE_APPROVAL_REQUIRED", 409);
      if (approval.subjectHash !== evaluation.bindingHash || approval.datasetId !== input.datasetId || approval.sourceId !== input.sourceId) fail("APPROVAL_VERSION_MISMATCH", 409);
    },
  };
}
