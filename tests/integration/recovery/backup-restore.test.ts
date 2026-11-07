import assert from "node:assert/strict";
import test from "node:test";

const OWNER = Object.freeze({ userId: "019a7000-1000-7000-8000-000000000001", roles: ["OWNER_ADMIN"] });
const BACKUP_ID = "database-backup-2026-11-07T08:00:00Z";
const OBJECT_SNAPSHOT_ID = "object-snapshot-2026-11-07T08:00:00Z";
const ISOLATED_ENVIRONMENT = "orb-restore-test-20261107";
const PRODUCTION_ENVIRONMENT = "orb-production";

interface RecoveryService {
  getBackupStatus(input: Record<string, unknown>): Promise<any>;
  startRestoreTest(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  runRestoreTest(input: Record<string, unknown>): Promise<any>;
  getRestoreTest(input: Record<string, unknown>): Promise<any>;
}
interface RecoveryModule {
  createInMemoryRecoveryService(options: Record<string, unknown>): RecoveryService;
}

const expectedSample = Object.freeze({
  rows: [{ table: "Project", id: "project-1", version: 12 }],
  hashes: [{ kind: "EvidenceObject", id: "evidence-1", sha256: "a".repeat(64) }],
  allocations: [{ id: "allocation-1", amount: "1250.000000", active: true }],
  approvals: [{ id: "approval-1", subjectVersion: 12, decision: "APPROVED" }],
  audit: [{ projectId: "project-1", sequenceNo: 8, eventHash: "b".repeat(64), previousEventHash: "c".repeat(64) }],
  objectLinks: [{ evidenceId: "evidence-1", objectKey: "evidence/evidence-1", objectVersionId: "version-1" }],
});

async function subject(overrides: Record<string, unknown> = {}): Promise<RecoveryService> {
  const modulePath = "../../../src/modules/recovery/restore-service.ts";
  const recovery = await import(modulePath) as RecoveryModule;
  return recovery.createInMemoryRecoveryService({
    now: () => "2026-11-07T08:10:00.000Z",
    productionEnvironment: PRODUCTION_ENVIRONMENT,
    snapshots: [{
      id: "snapshot-1", databaseBackupId: BACKUP_ID, objectSnapshotId: OBJECT_SNAPSHOT_ID,
      completedAt: "2026-11-07T08:00:00.000Z", encrypted: true, separateCopy: true,
      rpoMinutes: 10, manifestHash: "d".repeat(64), sample: expectedSample,
    }],
    restoreAdapter: {
      restore: async () => ({
        completedAt: "2026-11-07T08:40:00.000Z", sourceLatestWriteAt: "2026-11-07T07:55:00.000Z",
        sample: structuredClone(expectedSample), evidenceId: "019a7000-1000-7000-8000-000000000099",
      }),
    },
    ...overrides,
  });
}
const command = (key: string) => ({ principal: OWNER, idempotencyKey: key, correlationId: key });

async function queued(service: RecoveryService, environment = ISOLATED_ENVIRONMENT) {
  return service.startRestoreTest({ backupId: BACKUP_ID, objectSnapshotId: OBJECT_SNAPSHOT_ID,
    isolatedEnvironment: environment, ...command(`start-${environment}`) });
}

test("backup status reports the latest paired encrypted separate-copy snapshot within the RPO target", async () => {
  const service = await subject();
  const status = await service.getBackupStatus({ principal: OWNER });
  assert.deepEqual(status, {
    lastSuccessfulBackupAt: "2026-11-07T08:00:00.000Z",
    rpoMinutes: 10,
    encrypted: true,
    separateCopy: true,
    lastRestoreTest: null,
  });
  assert.ok(status.rpoMinutes <= 15);
  for (const secret of ["credential", "password", "secret", "accessKey", "connectionString"])
    assert.equal(Object.hasOwn(status, secret), false);
});

test("restore refuses production and mismatched database/object snapshots before any restore side effect", async () => {
  let restoreCalls = 0;
  const service = await subject({ restoreAdapter: { restore: async () => { restoreCalls++; throw new Error("must not run"); } } });
  await assert.rejects(() => queued(service, PRODUCTION_ENVIRONMENT), /isolated|production|target/i);
  await assert.rejects(() => service.startRestoreTest({ backupId: BACKUP_ID, objectSnapshotId: "other-object-snapshot",
    isolatedEnvironment: ISOLATED_ENVIRONMENT, ...command("mismatched-pair") }), /snapshot|pair|manifest|not found/i);
  assert.equal(restoreCalls, 0);
});

test("isolated restore advances QUEUED to RUNNING to PASSED only after every sampled link matches", async () => {
  const service = await subject();
  const started = await queued(service);
  assert.equal(started.replayed, false);
  assert.equal(started.value.state, "QUEUED");
  assert.equal(started.value.completedAt, null);
  const replay = await queued(service);
  assert.equal(replay.replayed, true);
  assert.equal(replay.value.id, started.value.id);

  const completed = await service.runRestoreTest({ restoreTestId: started.value.id, ...command("run-isolated-restore") });
  assert.equal(completed.state, "PASSED");
  assert.equal(completed.rpoMinutes, 5);
  assert.equal(completed.rtoMinutes, 30);
  assert.ok(completed.evidenceId);
  assert.deepEqual(completed.integrity, {
    rowsAndVersions: true, hashes: true, allocations: true, approvals: true,
    auditChain: true, objectLinks: true, missing: [], mismatched: [],
  });
  assert.deepEqual(await service.getRestoreTest({ restoreTestId: started.value.id, principal: OWNER }), completed);
});

test("missing row/version/hash/allocation/approval/audit/object linkage makes the restore test FAILED", async () => {
  const families = ["rows", "hashes", "allocations", "approvals", "audit", "objectLinks"] as const;
  for (const family of families) {
    const restored = structuredClone(expectedSample) as Record<string, unknown[]>;
    restored[family] = [];
    const service = await subject({ restoreAdapter: { restore: async () => ({
      completedAt: "2026-11-07T08:40:00.000Z", sourceLatestWriteAt: "2026-11-07T07:55:00.000Z",
      sample: restored, evidenceId: "019a7000-1000-7000-8000-000000000099",
    }) } });
    const started = await queued(service, `${ISOLATED_ENVIRONMENT}-${family}`);
    const result = await service.runRestoreTest({ restoreTestId: started.value.id, ...command(`run-${family}`) });
    assert.equal(result.state, "FAILED", family);
    assert.ok(result.integrity.missing.length > 0 || result.integrity.mismatched.length > 0, family);
  }
});

test("RPO over 15 minutes or RTO over 4 hours cannot produce PASS even when sampled integrity matches", async () => {
  const cases = [
    { label: "rpo", sourceLatestWriteAt: "2026-11-07T07:40:00.000Z", completedAt: "2026-11-07T08:40:00.000Z" },
    { label: "rto", sourceLatestWriteAt: "2026-11-07T07:55:00.000Z", completedAt: "2026-11-07T12:11:00.000Z" },
  ];
  for (const item of cases) {
    const service = await subject({ restoreAdapter: { restore: async () => ({ ...item,
      sample: structuredClone(expectedSample), evidenceId: "019a7000-1000-7000-8000-000000000099",
    }) } });
    const started = await queued(service, `${ISOLATED_ENVIRONMENT}-${item.label}`);
    const result = await service.runRestoreTest({ restoreTestId: started.value.id, ...command(`run-${item.label}`) });
    assert.equal(result.state, "FAILED", item.label);
    assert.ok(result.rpoMinutes > 15 || result.rtoMinutes > 240, item.label);
  }
});
