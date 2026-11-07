export interface BackupSnapshot<Sample = unknown> {
  readonly id: string;
  readonly databaseBackupId: string;
  readonly objectSnapshotId: string;
  readonly completedAt: string;
  readonly encrypted: boolean;
  readonly separateCopy: boolean;
  readonly rpoMinutes: number;
  readonly manifestHash: string;
  readonly sample: Sample;
}

function instant(value: string, label: string): number {
  const time = Date.parse(value); if (!Number.isFinite(time)) throw new TypeError(`invalid ${label}`); return time;
}
export function latestProtectedSnapshot<Sample>(snapshots: readonly BackupSnapshot<Sample>[]): BackupSnapshot<Sample> {
  const eligible = snapshots.filter((item) => item.encrypted && item.separateCopy && Number.isInteger(item.rpoMinutes) && item.rpoMinutes >= 0
    && /^[a-f0-9]{64}$/.test(item.manifestHash));
  if (eligible.length === 0) throw new Error("no encrypted separate-copy recovery snapshot is available");
  return [...eligible].sort((a, b) => instant(b.completedAt, "backup completion") - instant(a.completedAt, "backup completion"))[0];
}
export function backupStatus<Sample, Restore>(snapshots: readonly BackupSnapshot<Sample>[], lastRestoreTest: Restore | null) {
  const latest = latestProtectedSnapshot(snapshots);
  return Object.freeze({ lastSuccessfulBackupAt: latest.completedAt, rpoMinutes: latest.rpoMinutes,
    encrypted: latest.encrypted, separateCopy: latest.separateCopy, lastRestoreTest: lastRestoreTest === null ? null : structuredClone(lastRestoreTest) });
}
