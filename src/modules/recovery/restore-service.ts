import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { backupStatus, type BackupSnapshot } from "./backup-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { checkRestoreIntegrity, integrityPassed, type RecoverySample, type RestoreIntegrityResult } from "./integrity-check.ts";

type Row = Record<string, unknown>;
interface Principal { readonly userId: string; readonly roles: readonly string[] }
interface RestoreAdapterResult { readonly completedAt: string; readonly sourceLatestWriteAt: string; readonly sample: RecoverySample; readonly evidenceId: string }
interface RestoreAdapter { restore(input: { backupId: string; objectSnapshotId: string; isolatedEnvironment: string; restoreTestId: string }): Promise<RestoreAdapterResult> }
interface RestoreTest {
  id: string; version: number; state: "QUEUED" | "RUNNING" | "PASSED" | "FAILED"; requestedAt: string; completedAt: string | null;
  rpoMinutes: number | null; rtoMinutes: number | null; evidenceId: string | null; integrity: RestoreIntegrityResult | null;
  backupId: string; objectSnapshotId: string; isolatedEnvironment: string; requestedBy: string;
}
interface Options { now?: () => string; productionEnvironment: string; snapshots: readonly BackupSnapshot<RecoverySample>[]; restoreAdapter: RestoreAdapter }

const clone = <T>(value: T): T => structuredClone(value);
function frozen<T>(value: T): T { const copy = clone(value); const visit = (item: unknown) => { if (item && typeof item === "object" && !Object.isFrozen(item)) { Object.values(item).forEach(visit); Object.freeze(item); } }; visit(copy); return copy; }
function owner(value: unknown): Principal {
  const principal = value as Principal | undefined;
  if (!principal || typeof principal.userId !== "string" || !Array.isArray(principal.roles) || !principal.roles.includes("OWNER_ADMIN")) throw new Error("Owner/Admin permission required");
  return principal;
}
function required(value: unknown, label: string): string { if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`); return value.trim(); }
function millis(value: string, label: string): number { const result = Date.parse(value); if (!Number.isFinite(result)) throw new TypeError(`invalid ${label}`); return result; }
function minutes(later: string, earlier: string): number { return Math.max(0, Math.ceil((millis(later, "completion time") - millis(earlier, "start time")) / 60_000)); }
function sameCommand(a: Row, b: Row) { return createHash("sha256").update(JSON.stringify(a)).digest("hex") === createHash("sha256").update(JSON.stringify(b)).digest("hex"); }

export function createInMemoryRecoveryService(options: Row) {
  const settings = options as unknown as Options;
  if (!settings || typeof settings.productionEnvironment !== "string" || !Array.isArray(settings.snapshots) || typeof settings.restoreAdapter?.restore !== "function")
    throw new TypeError("invalid recovery service options");
  const now = typeof settings.now === "function" ? settings.now : () => new Date().toISOString();
  const snapshots = settings.snapshots.map(clone), tests = new Map<string, RestoreTest>();
  const idempotency = new Map<string, { input: Row; id: string }>();
  const snapshotPair = (backupId: string, objectSnapshotId: string) => snapshots.find((item) => item.databaseBackupId === backupId && item.objectSnapshotId === objectSnapshotId);
  const getTest = (id: unknown) => { const row = typeof id === "string" ? tests.get(id) : undefined; if (!row) throw new Error("restore test not found"); return row; };
  return {
    async getBackupStatus(input: Row) {
      owner(input.principal); const latest = [...tests.values()].sort((a, b) => millis(b.requestedAt, "1970-01-01T00:00:00.000Z") - millis(a.requestedAt, "1970-01-01T00:00:00.000Z"))[0] ?? null;
      return frozen(backupStatus(snapshots, latest));
    },
    async startRestoreTest(input: Row) {
      const actor = owner(input.principal), backupId = required(input.backupId, "backupId"), objectSnapshotId = required(input.objectSnapshotId, "objectSnapshotId");
      const isolatedEnvironment = required(input.isolatedEnvironment, "isolatedEnvironment"), idempotencyKey = required(input.idempotencyKey, "idempotencyKey");
      if (isolatedEnvironment === settings.productionEnvironment || /(^|[-_.])prod(?:uction)?($|[-_.])/i.test(isolatedEnvironment)) throw new Error("restore target must be isolated and cannot be production");
      const snapshot = snapshotPair(backupId, objectSnapshotId);
      if (!snapshot) throw new Error("database backup and object snapshot pair not found in one manifest");
      if (!snapshot.encrypted || !snapshot.separateCopy) throw new Error("snapshot pair is not an encrypted separate copy");
      const commandInput = { backupId, objectSnapshotId, isolatedEnvironment }, key = `${actor.userId}:${idempotencyKey}`, prior = idempotency.get(key);
      if (prior) { if (!sameCommand(prior.input, commandInput)) throw new Error("idempotency key reused with different restore command"); return { value: frozen(getTest(prior.id)), replayed: true }; }
      const row: RestoreTest = { id: randomUUID(), version: 1, state: "QUEUED", requestedAt: now(), completedAt: null, rpoMinutes: null,
        rtoMinutes: null, evidenceId: null, integrity: null, backupId, objectSnapshotId, isolatedEnvironment, requestedBy: actor.userId };
      tests.set(row.id, row); idempotency.set(key, { input: commandInput, id: row.id }); return { value: frozen(row), replayed: false };
    },
    async runRestoreTest(input: Row) {
      owner(input.principal); const row = getTest(input.restoreTestId);
      if (row.state === "PASSED" || row.state === "FAILED") return frozen(row);
      if (row.state !== "QUEUED") throw new Error("restore test is already running");
      const snapshot = snapshotPair(row.backupId, row.objectSnapshotId); if (!snapshot) throw new Error("snapshot pair disappeared");
      row.state = "RUNNING"; row.version += 1;
      try {
        const restored = await settings.restoreAdapter.restore({ backupId: row.backupId, objectSnapshotId: row.objectSnapshotId,
          isolatedEnvironment: row.isolatedEnvironment, restoreTestId: row.id });
        const integrity = checkRestoreIntegrity(snapshot.sample, restored.sample);
        row.completedAt = restored.completedAt; row.rpoMinutes = minutes(snapshot.completedAt, restored.sourceLatestWriteAt);
        row.rtoMinutes = minutes(restored.completedAt, row.requestedAt); row.evidenceId = required(restored.evidenceId, "evidenceId"); row.integrity = integrity;
        row.state = integrityPassed(integrity) && row.rpoMinutes <= 15 && row.rtoMinutes <= 240 ? "PASSED" : "FAILED"; row.version += 1;
      } catch (error) {
        row.completedAt = now(); row.state = "FAILED"; row.version += 1;
        if (error instanceof TypeError) throw error;
      }
      return frozen(row);
    },
    async getRestoreTest(input: Row) { owner(input.principal); return frozen(getTest(input.restoreTestId)); },
  };
}
