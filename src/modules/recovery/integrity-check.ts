type Row = Readonly<Record<string, unknown>>;

export interface RecoverySample {
  readonly rows: readonly Row[];
  readonly hashes: readonly Row[];
  readonly allocations: readonly Row[];
  readonly approvals: readonly Row[];
  readonly audit: readonly Row[];
  readonly objectLinks: readonly Row[];
}

export interface RestoreIntegrityResult {
  readonly rowsAndVersions: boolean;
  readonly hashes: boolean;
  readonly allocations: boolean;
  readonly approvals: boolean;
  readonly auditChain: boolean;
  readonly objectLinks: boolean;
  readonly missing: readonly string[];
  readonly mismatched: readonly string[];
}

const FAMILIES = [
  ["rows", "rowsAndVersions"], ["hashes", "hashes"], ["allocations", "allocations"],
  ["approvals", "approvals"], ["audit", "auditChain"], ["objectLinks", "objectLinks"],
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value);
}
function identity(family: keyof RecoverySample, row: Row): string {
  const keys: Record<keyof RecoverySample, readonly string[]> = {
    rows: ["table", "id"], hashes: ["kind", "id"], allocations: ["id"], approvals: ["id"],
    audit: ["projectId", "sequenceNo"], objectLinks: ["evidenceId", "objectKey"],
  };
  return keys[family].map((key) => String(row[key] ?? "<missing>")).join(":");
}
function validSample(value: unknown): value is RecoverySample {
  return value !== null && typeof value === "object" && FAMILIES.every(([family]) => Array.isArray((value as Record<string, unknown>)[family]));
}

export function checkRestoreIntegrity(expected: RecoverySample, restored: RecoverySample): RestoreIntegrityResult {
  if (!validSample(expected) || !validSample(restored)) throw new TypeError("recovery samples must contain every integrity family");
  const missing: string[] = [], mismatched: string[] = [];
  const flags: Record<string, boolean> = {};
  for (const [family, flag] of FAMILIES) {
    const actualById = new Map(restored[family].map((row) => [identity(family, row), row]));
    for (const row of expected[family]) {
      const id = identity(family, row), actual = actualById.get(id);
      if (!actual) missing.push(`${family}:${id}`);
      else if (canonical(actual) !== canonical(row)) mismatched.push(`${family}:${id}`);
    }
    flags[flag] = !missing.some((item) => item.startsWith(`${family}:`))
      && !mismatched.some((item) => item.startsWith(`${family}:`));
  }
  return Object.freeze({ rowsAndVersions: flags.rowsAndVersions, hashes: flags.hashes,
    allocations: flags.allocations, approvals: flags.approvals, auditChain: flags.auditChain,
    objectLinks: flags.objectLinks, missing: Object.freeze(missing), mismatched: Object.freeze(mismatched) });
}

export function integrityPassed(value: RestoreIntegrityResult): boolean {
  return value.rowsAndVersions && value.hashes && value.allocations && value.approvals && value.auditChain
    && value.objectLinks && value.missing.length === 0 && value.mismatched.length === 0;
}
