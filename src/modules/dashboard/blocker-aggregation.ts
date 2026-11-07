export interface SourceLink {
  readonly operationId: string;
  readonly href: string;
}

export interface AuthoritativeBlocker {
  readonly id: string;
  readonly family: string;
  readonly projectId: string | null;
  readonly occurredAt: string;
  readonly severity: "CRITICAL" | "BLOCKING" | "ACTION" | "INFO";
  readonly label: string;
  readonly source: SourceLink;
}

const SEVERITY_ORDER = Object.freeze({ CRITICAL: 0, BLOCKING: 1, ACTION: 2, INFO: 3 });

function requiredString(row: Readonly<Record<string, unknown>>, name: string): string {
  const value = row[name];
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`invalid authoritative blocker ${name}`);
  return value;
}

export function toAuthoritativeBlocker(family: string, row: Readonly<Record<string, unknown>>): AuthoritativeBlocker {
  const severity = requiredString(row, "severity");
  if (!Object.hasOwn(SEVERITY_ORDER, severity)) throw new TypeError("invalid authoritative blocker severity");
  const projectId = row.projectId;
  if (projectId !== null && projectId !== undefined && typeof projectId !== "string") throw new TypeError("invalid authoritative blocker projectId");
  return Object.freeze({
    id: requiredString(row, "id"),
    family,
    projectId: projectId ?? null,
    occurredAt: requiredString(row, "occurredAt"),
    severity: severity as AuthoritativeBlocker["severity"],
    label: requiredString(row, "label"),
    source: Object.freeze({ operationId: requiredString(row, "operationId"), href: requiredString(row, "href") }),
  });
}

export function orderAuthoritativeBlockers(rows: readonly AuthoritativeBlocker[]): readonly AuthoritativeBlocker[] {
  return Object.freeze([...rows].sort((left, right) =>
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.occurredAt.localeCompare(right.occurredAt)
    || left.id.localeCompare(right.id)));
}
