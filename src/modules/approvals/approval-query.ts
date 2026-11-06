const REQUIRED_FIELDS = [
  "approvalId", "actionCode", "subjectType", "subjectId", "subjectReference", "subjectVersion", "subjectHash",
  "changedFields", "evidence", "detectedConflicts", "requester", "requestedAt", "requiredRole", "decisionContext",
  "approvalState", "approvalVersion",
] as const;
const SHA256 = /^[a-f0-9]{64}$/;
const STATES = new Set(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`invalid approval inbox ${name}`);
  return value;
}
function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`invalid approval inbox ${name}`);
  return value;
}
function requireNonempty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`invalid approval inbox ${name}`);
  return value;
}

export function toApprovalInboxItem(row: Record<string, unknown>): Record<string, unknown> {
  for (const field of REQUIRED_FIELDS) if (!Object.hasOwn(row, field) || row[field] === undefined) throw new TypeError(`approval inbox required field ${field}`);
  requireNonempty(row.approvalId, "approvalId");
  requireNonempty(row.actionCode, "actionCode");
  requireNonempty(row.subjectType, "subjectType");
  requireNonempty(row.subjectId, "subjectId");
  requireNonempty(row.subjectReference, "subjectReference");
  if (!Number.isSafeInteger(row.subjectVersion) || Number(row.subjectVersion) < 1) throw new TypeError("invalid approval inbox subjectVersion");
  if (typeof row.subjectHash !== "string" || !SHA256.test(row.subjectHash)) throw new TypeError("invalid approval inbox subject hash");
  const changedFields = requireArray(row.changedFields, "changedFields");
  const evidence = requireArray(row.evidence, "evidence");
  const conflicts = requireArray(row.detectedConflicts, "detectedConflicts");
  const requester = requireRecord(row.requester, "requester");
  requireNonempty(requester.userId, "requester.userId");
  requireNonempty(requester.displayName, "requester.displayName");
  requireArray(requester.roles, "requester.roles");
  requireNonempty(row.requestedAt, "requestedAt");
  if (row.requiredRole !== "OWNER_ADMIN") throw new TypeError("invalid approval inbox Owner role");
  const context = requireRecord(row.decisionContext, "decisionContext");
  requireNonempty(context.summary, "decisionContext.summary");
  if (context.reason !== null) requireNonempty(context.reason, "decisionContext.reason");
  requireArray(context.consequences, "decisionContext.consequences");
  if (context.proposedOutcome !== null) requireNonempty(context.proposedOutcome, "decisionContext.proposedOutcome");
  if (context.selfApprovalAllowed !== false) throw new TypeError("invalid approval inbox self approval");
  if (!STATES.has(String(row.approvalState))) throw new TypeError("invalid approval inbox state");
  if (!Number.isSafeInteger(row.approvalVersion) || Number(row.approvalVersion) < 1) throw new TypeError("invalid approval inbox version");

  for (const [index, field] of changedFields.entries()) {
    const item = requireRecord(field, `changedFields[${index}]`);
    for (const key of ["fieldPath", "displayLabel", "before", "after"]) if (!Object.hasOwn(item, key)) throw new TypeError(`invalid approval inbox changed field ${key}`);
  }
  for (const [index, conflict] of conflicts.entries()) {
    const item = requireRecord(conflict, `detectedConflicts[${index}]`);
    for (const key of ["code", "severity", "message", "subjectType", "subjectId"]) if (!Object.hasOwn(item, key)) throw new TypeError(`invalid approval inbox conflict ${key}`);
  }

  return Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, structuredClone(row[field])]));
}
