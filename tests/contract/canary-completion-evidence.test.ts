import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeCanaryEvidence } from "../../ops/canary/finalize-canary-evidence.mjs";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function monitoringEvidence() {
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    gate: "controlled-canary-monitoring-evidence",
    releaseCommit: "a".repeat(40),
    targetOrigin: "https://canary.orb.example",
    startsAtUtc: "2026-11-12T08:00:00.000Z",
    endsAtUtc: "2026-11-13T08:00:00.000Z",
    maxUsers: 2,
    maxProjects: 1,
    userIds: ["pilot-user-01", "pilot-user-02"],
    projectIds: ["pilot-project-01"],
    approvedPlanSha256: "b".repeat(64),
    approvedUatEvidenceSha256: "c".repeat(64),
    preflightEvidenceSha256: "d".repeat(64),
    ownerApproved: true,
    ownerRealDataAuthorized: true,
    ownerApproverId: "orb-owner-01",
    ownerApprovedAtUtc: "2026-11-12T07:55:00.000Z",
    ownerApprovalExpiresAtUtc: "2026-11-13T08:00:00.000Z",
    preflightGeneratedAtUtc: "2026-11-12T08:00:00.000Z",
    monitoring: {
      operatorId: "monitor-operator-01",
      healthIntervalSeconds: 60,
      maxErrorRatePercent: 1,
      maxP95LatencyMs: 500,
      maxConsecutiveReadinessFailures: 1,
    },
    stopConditions: [
      "permissionBypass",
      "attachmentIsolationFailure",
      "dataIntegrityFailure",
      "readinessThresholdExceeded",
      "errorRateThresholdExceeded",
      "latencyThresholdExceeded",
    ],
    readiness: true,
    consecutiveReadinessFailures: 0,
    errorRatePercent: 0.2,
    p95LatencyMs: 250,
    securityEvents: {
      permissionBypass: false,
      attachmentIsolationFailure: false,
      dataIntegrityFailure: false,
    },
    observationId: "sample-003",
    observationIds: ["sample-001", "sample-002", "sample-003"],
    sampleSequence: 3,
    previousMonitoringEvidenceSha256: "2".repeat(64),
    previousMonitoringEvidenceSha256s: ["1".repeat(64), "2".repeat(64)],
    evaluatedAtUtc: "2026-11-12T10:00:00.000Z",
    passed: true,
  };
  evidence.monitoringEvidenceSha256 = sha256(evidence);
  return evidence;
}

function completion() {
  const evidence = monitoringEvidence();
  return {
    schemaVersion: 1,
    releaseCommit: evidence.releaseCommit,
    preflightEvidenceSha256: evidence.preflightEvidenceSha256,
    finalMonitoringEvidenceSha256: evidence.monitoringEvidenceSha256,
    completedAtUtc: "2026-11-12T10:00:30.000Z",
    ownerReviewed: true,
    ownerReviewerId: evidence.ownerApproverId,
    ownerReviewedAtUtc: "2026-11-12T10:05:00.000Z",
  };
}

test("canary completion binds fresh final monitoring evidence and post-walkthrough owner review", () => {
  const monitoring = monitoringEvidence();
  const result = finalizeCanaryEvidence({ monitoringEvidence: monitoring, completion: completion() });
  assert.equal(result.gate, "controlled-canary-completion-evidence");
  assert.equal(result.releaseCommit, monitoring.releaseCommit);
  assert.equal(result.approvedUatEvidenceSha256, monitoring.approvedUatEvidenceSha256);
  assert.equal(result.sampleSequence, 3);
  assert.equal(result.ownerReviewed, true);
  assert.match(result.completionEvidenceSha256, /^[a-f0-9]{64}$/);
  const { completionEvidenceSha256: _digest, ...payload } = result;
  assert.equal(result.completionEvidenceSha256, sha256(payload));
});

test("canary completion certificate preserves approved authorization and pilot scope", () => {
  const monitoring = monitoringEvidence();
  const result = finalizeCanaryEvidence({ monitoringEvidence: monitoring, completion: completion() });

  assert.equal(result.targetOrigin, monitoring.targetOrigin);
  assert.equal(result.startsAtUtc, monitoring.startsAtUtc);
  assert.equal(result.endsAtUtc, monitoring.endsAtUtc);
  assert.equal(result.ownerApproverId, monitoring.ownerApproverId);
  assert.equal(result.ownerApprovedAtUtc, monitoring.ownerApprovedAtUtc);
  assert.equal(result.ownerApprovalExpiresAtUtc, monitoring.ownerApprovalExpiresAtUtc);
  assert.equal(result.maxUsers, monitoring.maxUsers);
  assert.equal(result.maxProjects, monitoring.maxProjects);
  assert.deepEqual(result.userIds, monitoring.userIds);
  assert.deepEqual(result.projectIds, monitoring.projectIds);
});

test("canary completion rejects tampered or non-passing final monitoring evidence", () => {
  for (const patch of [{ passed: false }, { sampleSequence: 2 }, { evaluatedAtUtc: "2026-11-12T10:00:01.000Z" }]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: { ...monitoringEvidence(), ...patch }, completion: completion() }),
      /final monitoring evidence.*(passing|intact|chain)/i,
    );
  }
});

test("canary completion rejects a truncated or disconnected monitoring digest chain", () => {
  for (const patch of [
    { previousMonitoringEvidenceSha256s: ["2".repeat(64)] },
    { previousMonitoringEvidenceSha256s: ["2".repeat(64), "2".repeat(64)] },
    { previousMonitoringEvidenceSha256: "3".repeat(64) },
  ]) {
    const monitoring = { ...monitoringEvidence(), ...patch };
    const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
    monitoring.monitoringEvidenceSha256 = sha256(payload);
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoring,
        completion: {
          ...completion(),
          finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        },
      }),
      /final monitoring evidence.*(intact|chain)/i,
    );
  }
});

test("canary completion rejects final monitoring evaluated outside the approved window", () => {
  const monitoring = {
    ...monitoringEvidence(),
    evaluatedAtUtc: "2026-11-12T07:59:30.000Z",
  };
  const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
  monitoring.monitoringEvidenceSha256 = sha256(payload);

  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoring,
      completion: {
        ...completion(),
        finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        completedAtUtc: "2026-11-12T08:00:00.000Z",
        ownerReviewedAtUtc: "2026-11-12T08:00:01.000Z",
      },
      now: new Date("2026-11-12T08:00:01.000Z"),
    }),
    /final monitoring evaluation.*approved window/i,
  );
});

test("canary completion rejects stale or out-of-window closure", () => {
  for (const completedAtUtc of ["2026-11-12T10:01:00.001Z", "2026-11-13T08:00:00.000Z"]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), completedAtUtc } }),
      /completion.*(health interval|approved window)/i,
    );
  }
});

test("canary completion independently rejects a final sample with a mandatory stop breach", () => {
  for (const patch of [
    { readiness: false, consecutiveReadinessFailures: 2 },
    { errorRatePercent: 1.01 },
    { p95LatencyMs: 500.01 },
    { securityEvents: { permissionBypass: true, attachmentIsolationFailure: false, dataIntegrityFailure: false } },
  ]) {
    const monitoring = { ...monitoringEvidence(), ...patch };
    const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
    monitoring.monitoringEvidenceSha256 = sha256(payload);
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoring,
        completion: {
          ...completion(),
          finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        },
      }),
      /mandatory stop condition/i,
    );
  }
});

test("canary completion requires a valid approved UAT evidence binding", () => {
  const monitoring = { ...monitoringEvidence(), approvedUatEvidenceSha256: "not-a-digest" };
  const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
  monitoring.monitoringEvidenceSha256 = sha256(payload);
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoring,
      completion: {
        ...completion(),
        finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
      },
    }),
    /approved UAT evidence/i,
  );
});

test("canary completion requires exact immutable release and evidence bindings", () => {
  for (const patch of [
    { releaseCommit: "f".repeat(40) },
    { preflightEvidenceSha256: "e".repeat(64) },
    { finalMonitoringEvidenceSha256: "f".repeat(64) },
  ]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), ...patch } }),
      /exact (release|preflight|final monitoring)/i,
    );
  }
});

test("canary completion rejects future-dated completion or owner review", () => {
  const now = new Date("2026-11-12T10:00:40.000Z");
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoringEvidence(),
      completion: { ...completion(), completedAtUtc: "2026-11-12T10:00:41.000Z", ownerReviewedAtUtc: "2026-11-12T10:00:41.000Z" },
      now,
    }),
    /completion and owner review must not be future-dated/i,
  );
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoringEvidence(),
      completion: { ...completion(), ownerReviewedAtUtc: "2026-11-12T10:00:41.000Z" },
      now,
    }),
    /completion and owner review must not be future-dated/i,
  );
  assert.equal(finalizeCanaryEvidence({
    monitoringEvidence: monitoringEvidence(), completion: completion(), now: new Date("2026-11-12T10:05:00.000Z"),
  }).passed, true);
});

test("canary completion independently requires owner authorization", () => {
  for (const patch of [
    { ownerApproved: false },
    { ownerRealDataAuthorized: false },
  ]) {
    const monitoring = { ...monitoringEvidence(), ...patch };
    const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
    monitoring.monitoringEvidenceSha256 = sha256(payload);
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoring,
        completion: {
          ...completion(),
          finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        },
      }),
      /owner approval and real-data authorization/i,
    );
  }
});

test("canary completion independently rejects impossible owner authorization chronology", () => {
  for (const patch of [
    { ownerApprovedAtUtc: "2026-11-12T10:00:01.000Z" },
    { preflightGeneratedAtUtc: "2026-11-12T10:00:01.000Z" },
  ]) {
    const monitoring = { ...monitoringEvidence(), ...patch };
    const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
    monitoring.monitoringEvidenceSha256 = sha256(payload);
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoring,
        completion: {
          ...completion(),
          finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        },
      }),
      /owner authorization chronology/i,
    );
  }
});

test("canary completion requires owner review inside the approved authorization window", () => {
  for (const ownerReviewedAtUtc of [
    "2026-11-13T08:00:00.000Z",
    "2026-11-13T08:00:00.001Z",
  ]) {
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoringEvidence(),
        completion: { ...completion(), ownerReviewedAtUtc },
        now: new Date("2026-11-13T08:00:01.000Z"),
      }),
      /owner review.*(approved window|authorization)/i,
    );
  }

  const authorizationEndsFirst = monitoringEvidence();
  authorizationEndsFirst.ownerApprovalExpiresAtUtc = "2026-11-12T10:04:00.000Z";
  authorizationEndsFirst.monitoringEvidenceSha256 = sha256(
    Object.fromEntries(Object.entries(authorizationEndsFirst).filter(([key]) => key !== "monitoringEvidenceSha256")),
  );
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: authorizationEndsFirst,
      completion: {
        ...completion(),
        finalMonitoringEvidenceSha256: authorizationEndsFirst.monitoringEvidenceSha256,
      },
    }),
    /owner review.*authorization/i,
  );
});

test("canary completion requires owner review strictly after walkthrough completion", () => {
  for (const patch of [
    { ownerReviewed: false },
    { ownerReviewerId: "different-owner" },
    { ownerReviewedAtUtc: "2026-11-12T10:00:30.000Z" },
    { ownerReviewedAtUtc: "2026-11-12T10:00:29.999Z" },
  ]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), ...patch } }),
      /owner review/i,
    );
  }
});

test("canary completion independently rejects an invalid approved pilot scope", () => {
  for (const patch of [
    { maxUsers: 6 },
    { maxProjects: 4 },
    { userIds: [] },
    { userIds: ["pilot-user-01", "pilot-user-01"] },
    { userIds: ["pilot-user-01", "pilot-user-02", "pilot-user-03"] },
    { userIds: ["invalid pilot user"] },
    { projectIds: [] },
    { projectIds: ["pilot-project-01", "pilot-project-01"] },
    { projectIds: ["pilot-project-01", "pilot-project-02"] },
    { projectIds: ["invalid pilot project"] },
  ]) {
    const monitoring = { ...monitoringEvidence(), ...patch };
    const { monitoringEvidenceSha256: _digest, ...payload } = monitoring;
    monitoring.monitoringEvidenceSha256 = sha256(payload);
    assert.throws(
      () => finalizeCanaryEvidence({
        monitoringEvidence: monitoring,
        completion: {
          ...completion(),
          finalMonitoringEvidenceSha256: monitoring.monitoringEvidenceSha256,
        },
      }),
      /approved pilot scope/i,
    );
  }
});

test("canary completion closes input envelopes", () => {
  assert.throws(
    () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), override: true } }),
    /unknown canary completion field/i,
  );
  assert.throws(
    () => finalizeCanaryEvidence({ monitoringEvidence: { ...monitoringEvidence(), override: true }, completion: completion() }),
    /unknown final monitoring evidence field/i,
  );
});


test("canary completion CLI emits certified evidence and rejects ambiguous inputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-completion-"));
  const monitoringPath = join(directory, "monitoring.json");
  const completionPath = join(directory, "completion.json");
  writeFileSync(monitoringPath, JSON.stringify(monitoringEvidence()));
  writeFileSync(completionPath, JSON.stringify(completion()));
  const cli = join(process.cwd(), "ops/canary/finalize-canary-evidence.mjs");

  const result = spawnSync(process.execPath, [cli, "--monitoring-evidence", monitoringPath, "--completion", completionPath], {
    cwd: process.cwd(), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).gate, "controlled-canary-completion-evidence");

  const duplicate = spawnSync(process.execPath, [
    cli, "--monitoring-evidence", monitoringPath, "--monitoring-evidence", monitoringPath, "--completion", completionPath,
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /duplicate argument/i);
});
