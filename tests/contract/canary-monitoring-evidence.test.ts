import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { evaluateCanaryMonitoring } from "../../ops/canary/evaluate-canary-monitoring.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const evaluator = resolve(ROOT, "ops/canary/evaluate-canary-monitoring.mjs");
const commit = "a".repeat(40);
const digest = "b".repeat(64);
const evaluatedAtUtc = "2026-11-24T09:00:30.000Z";

const preflight = {
  schemaVersion: 1,
  gate: "controlled-canary-preflight",
  releaseCommit: commit,
  targetOrigin: "https://canary.orb.example",
  startsAtUtc: "2026-11-24T08:00:00.000Z",
  endsAtUtc: "2026-11-25T08:00:00.000Z",
  maxUsers: 2,
  maxProjects: 2,
  userIds: ["pilot-user-01", "pilot-user-02"],
  projectIds: ["pilot-project-01", "pilot-project-02"],
  approvedPlanSha256: digest,
  approvedUatEvidenceSha256: "c".repeat(64),
  ownerApproved: true,
  ownerRealDataAuthorized: true,
  ownerApproverId: "orb-owner-01",
  monitoringOperatorId: "orb-monitor-01",
  uatReportStartedAtUtc: "2026-11-23T07:30:00.000Z",
  uatReportCompletedAtUtc: "2026-11-23T07:44:00.000Z",
  uatEvidenceGeneratedAtUtc: "2026-11-23T07:45:00.000Z",
  uatLocales: [
    { locale: "en", direction: "ltr", passed: true },
    { locale: "ar", direction: "rtl", passed: true },
  ],
  ownerApprovedAtUtc: "2026-11-23T08:00:00.000Z",
  ownerApprovalExpiresAtUtc: "2026-11-25T12:00:00.000Z",
  preflightGeneratedAtUtc: "2026-11-24T08:00:00.000Z",
  monitoring: {
    operatorId: "orb-monitor-01",
    healthIntervalSeconds: 30,
    maxErrorRatePercent: 1,
    maxP95LatencyMs: 2000,
    maxConsecutiveReadinessFailures: 2,
  },
  rollbackOperatorId: "orb-operator-01",
  rollback: {
    command: "ops/deploy/rollback.sh",
    maxMinutes: 5,
    operatorId: "orb-operator-01",
  },
  stopConditions: [
    "permissionBypass",
    "attachmentIsolationFailure",
    "dataIntegrityFailure",
    "readinessThresholdExceeded",
    "errorRateThresholdExceeded",
    "latencyThresholdExceeded",
  ],
  passed: true,
};

function observations() {
  return {
    schemaVersion: 1,
    releaseCommit: commit,
    targetOrigin: "https://canary.orb.example",
    approvedPlanSha256: digest,
    observationId: "sample-20261124-090000-001",
    observedAtUtc: "2026-11-24T09:00:00.000Z",
    userIds: ["pilot-user-01", "pilot-user-02"],
    projectIds: ["pilot-project-01", "pilot-project-02"],
    monitoringOperatorId: "orb-monitor-01",
    readiness: true,
    consecutiveReadinessFailures: 0,
    errorRatePercent: 0.25,
    p95LatencyMs: 750,
    securityEvents: {
      permissionBypass: false,
      attachmentIsolationFailure: false,
      dataIntegrityFailure: false,
    },
  };
}

test("canary monitoring evidence fails closed on any approved threshold breach", () => {
  const safe = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: observations() });
  assert.equal(safe.passed, true);

  for (const patch of [
    { readiness: false, consecutiveReadinessFailures: 3 },
    { errorRatePercent: 1.01 },
    { p95LatencyMs: 2001 },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: { ...observations(), ...patch } }),
      /mandatory canary stop condition/i,
    );
  }
});

test("passing canary monitoring evidence preserves approved controls and evaluated outcomes", () => {
  const evidence = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: observations() });

  assert.equal(evidence.approvedUatEvidenceSha256, preflight.approvedUatEvidenceSha256);
  assert.equal(evidence.observationId, observations().observationId);
  assert.deepEqual(evidence.monitoring, preflight.monitoring);
  assert.deepEqual(evidence.stopConditions, preflight.stopConditions);
  assert.deepEqual(evidence.securityEvents, observations().securityEvents);
  assert.deepEqual(evidence.rollback, preflight.rollback);
  assert.equal(evidence.ownerApproved, true);
  assert.equal(evidence.ownerRealDataAuthorized, true);
  assert.equal(evidence.ownerApproverId, preflight.ownerApproverId);
  assert.equal(evidence.ownerApprovedAtUtc, preflight.ownerApprovedAtUtc);
  assert.equal(evidence.ownerApprovalExpiresAtUtc, preflight.ownerApprovalExpiresAtUtc);
  assert.equal(evidence.preflightGeneratedAtUtc, preflight.preflightGeneratedAtUtc);
  assert.equal(evidence.monitoringOperatorId, preflight.monitoringOperatorId);
  assert.equal(evidence.uatReportStartedAtUtc, preflight.uatReportStartedAtUtc);
  assert.equal(evidence.uatReportCompletedAtUtc, preflight.uatReportCompletedAtUtc);
  assert.equal(evidence.uatEvidenceGeneratedAtUtc, preflight.uatEvidenceGeneratedAtUtc);
  assert.deepEqual(evidence.uatLocales, preflight.uatLocales);
});

test("canary monitoring accepts and preserves the exact approved pilot cohort", () => {
  const scopedPreflight = {
    ...preflight,
    maxUsers: 2,
    maxProjects: 2,
    userIds: ["pilot-user-01", "pilot-user-02"],
    projectIds: ["pilot-project-01", "pilot-project-02"],
  };

  const evidence = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight: scopedPreflight, observation: observations() });

  assert.equal(evidence.maxUsers, scopedPreflight.maxUsers);
  assert.equal(evidence.maxProjects, scopedPreflight.maxProjects);
  assert.deepEqual(evidence.userIds, scopedPreflight.userIds);
  assert.deepEqual(evidence.projectIds, scopedPreflight.projectIds);
});

test("canary monitoring rejects a malformed approved pilot cohort", () => {
  const scopedPreflight = {
    ...preflight,
    maxUsers: 2,
    maxProjects: 1,
    userIds: ["pilot-user-01", "pilot-user-02"],
    projectIds: ["pilot-project-01"],
  };

  for (const patch of [
    { userIds: ["pilot-user-01", "pilot-user-01"] },
    { projectIds: [] },
    { maxUsers: 6 },
    { maxProjects: 0 },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight: { ...scopedPreflight, ...patch }, observation: observations() }),
      /approved pilot cohort/i,
    );
  }
});

test("canary monitoring evidence fails closed on every immediate security and integrity stop", () => {
  for (const stop of ["permissionBypass", "attachmentIsolationFailure", "dataIntegrityFailure"] as const) {
    const observation = observations();
    observation.securityEvents[stop] = true;
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation }),
      /mandatory canary stop condition/i,
    );
  }
});

test("canary monitoring evidence rejects unsupported observation claims", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({ evaluatedAtUtc,
      preflight,
      observation: { ...observations(), operatorOverride: "unapproved-operator" },
    }),
    /unknown canary observation field: operatorOverride/i,
  );

  const observation = observations();
  Object.assign(observation.securityEvents, { attachmentScanPassed: true });
  assert.throws(
    () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation }),
    /unknown canary security event field: attachmentScanPassed/i,
  );
});

test("canary monitoring evidence requires the supported observation schema", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({ evaluatedAtUtc,
      preflight,
      observation: { ...observations(), schemaVersion: 2 },
    }),
    /canary observation schemaVersion must be 1/i,
  );
});

test("canary monitoring independently validates approved preflight safety controls", () => {
  for (const patch of [
    { monitoring: { ...preflight.monitoring, operatorId: "" } },
    { monitoring: { ...preflight.monitoring, healthIntervalSeconds: 10 } },
    { monitoring: { ...preflight.monitoring, maxErrorRatePercent: 2 } },
    { monitoring: { ...preflight.monitoring, maxP95LatencyMs: Number.POSITIVE_INFINITY } },
    { monitoring: { ...preflight.monitoring, maxConsecutiveReadinessFailures: 0 } },
    { stopConditions: preflight.stopConditions.filter((condition) => condition !== "permissionBypass") },
    { stopConditions: [...preflight.stopConditions, "ignoreAuditFailure"] },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight: { ...preflight, ...patch }, observation: observations() }),
      /approved canary safety controls/i,
    );
  }
});


test("canary monitoring rejects owner approval based on UAT evidence older than 24 hours", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({
      evaluatedAtUtc,
      preflight: {
        ...preflight,
        uatReportStartedAtUtc: "2026-11-22T07:30:00.000Z",
        uatReportCompletedAtUtc: "2026-11-22T07:44:00.000Z",
        uatEvidenceGeneratedAtUtc: "2026-11-22T07:59:59.999Z",
      },
      observation: observations(),
    }),
    /approved owner authorization|UAT evidence.*24 hours/i,
  );
});

test("canary monitoring independently validates owner authorization and rollback accountability", () => {
  for (const patch of [
    { ownerApproved: false },
    { ownerRealDataAuthorized: false },
    { ownerApproverId: "" },
    { approvedUatEvidenceSha256: "not-a-digest" },
    { ownerApprovedAtUtc: "2026-11-25T12:00:00.000Z" },
    { ownerApprovalExpiresAtUtc: "2026-11-24T08:00:00.000Z" },
    { preflightGeneratedAtUtc: "2026-11-23T07:59:59.999Z" },
    { rollbackOperatorId: "different-operator" },
    { rollback: { ...preflight.rollback, command: "ops/deploy/unsafe.sh" } },
    { rollback: { ...preflight.rollback, maxMinutes: 6 } },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight: { ...preflight, ...patch }, observation: observations() }),
      /approved owner authorization and rollback accountability/i,
    );
  }
});

test("canary monitoring rejects unsupported approved preflight claims", () => {
  for (const candidate of [
    { ...preflight, emergencyOverride: true },
    { ...preflight, monitoring: { ...preflight.monitoring, ignoredAlertChannel: "ops" } },
    { ...preflight, rollback: { ...preflight.rollback, skipIntegrityCheck: true } },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight: candidate, observation: observations() }),
      /unknown approved canary (preflight|monitoring|rollback) field/i,
    );
  }
});


test("canary monitoring CLI emits validated evidence from immutable input files", () => {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-monitoring-cli-"));
  const preflightPath = join(directory, "preflight.json");
  const observationPath = join(directory, "observation.json");
  const now = Date.now();
  const runtimePreflight = {
    ...preflight,
    startsAtUtc: new Date(now - 60 * 60 * 1000).toISOString(),
    endsAtUtc: new Date(now + 60 * 60 * 1000).toISOString(),
    ownerApprovedAtUtc: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    ownerApprovalExpiresAtUtc: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    preflightGeneratedAtUtc: new Date(now - 60 * 60 * 1000).toISOString(),
    uatReportStartedAtUtc: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    uatReportCompletedAtUtc: new Date(now - 165 * 60 * 1000).toISOString(),
    uatEvidenceGeneratedAtUtc: new Date(now - 150 * 60 * 1000).toISOString(),
  };
  const runtimeObservation = {
    ...observations(),
    observedAtUtc: new Date(now - 1000).toISOString(),
  };
  writeFileSync(preflightPath, JSON.stringify(runtimePreflight));
  writeFileSync(observationPath, JSON.stringify(runtimeObservation));

  const result = spawnSync(process.execPath, [
    evaluator,
    "--preflight", preflightPath,
    "--observation", observationPath,
  ], { cwd: ROOT, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.gate, "controlled-canary-monitoring-evidence");
  assert.equal(evidence.passed, true);
  assert.equal(evidence.observedAtUtc, runtimeObservation.observedAtUtc);
  assert.match(evidence.evaluatedAtUtc, /Z$/);
});

test("canary monitoring CLI rejects unknown, missing, and duplicate inputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-monitoring-cli-invalid-"));
  const preflightPath = join(directory, "preflight.json");
  const alternatePreflightPath = join(directory, "alternate-preflight.json");
  const observationPath = join(directory, "observation.json");
  writeFileSync(preflightPath, JSON.stringify(preflight));
  writeFileSync(alternatePreflightPath, JSON.stringify(preflight));
  writeFileSync(observationPath, JSON.stringify(observations()));

  const cases = [
    ["unknown", ["--preflight", preflightPath, "--observation", observationPath, "--unsafe", "true"]],
    ["missing", ["--preflight", preflightPath]],
    ["duplicate", ["--preflight", preflightPath, "--preflight", alternatePreflightPath, "--observation", observationPath]],
  ] as const;

  for (const [label, args] of cases) {
    const result = spawnSync(process.execPath, [evaluator, ...args], { cwd: ROOT, encoding: "utf8" });
    assert.notEqual(result.status, 0, `${label} input unexpectedly passed`);
    assert.match(result.stderr, /unknown argument|missing value|usage|duplicate argument/i);
  }
});

test("canary monitoring evidence requires and preserves an immutable observation identity", () => {
  const evidence = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: observations() });
  assert.equal(evidence.observationId, observations().observationId);

  for (const observationId of [undefined, "", "sample identity with spaces", "x".repeat(129)] as const) {
    assert.throws(
      () => evaluateCanaryMonitoring({
        evaluatedAtUtc,
        preflight,
        observation: { ...observations(), observationId },
      }),
      /observation identity/i,
    );
  }
});

test("canary monitoring observations cover the exact approved pilot cohort", () => {
  const evidence = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: observations() });
  assert.deepEqual(evidence.userIds, preflight.userIds);
  assert.deepEqual(evidence.projectIds, preflight.projectIds);

  for (const patch of [
    { userIds: undefined },
    { userIds: ["pilot-user-01"] },
    { userIds: ["pilot-user-02", "pilot-user-01"] },
    { userIds: ["pilot-user-01", "unapproved-user"] },
    { projectIds: undefined },
    { projectIds: ["pilot-project-01"] },
    { projectIds: ["pilot-project-02", "pilot-project-01"] },
    { projectIds: ["pilot-project-01", "unapproved-project"] },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: { ...observations(), ...patch } }),
      /exact approved pilot cohort/i,
    );
  }
});

test("canary monitoring observations require the exact approved monitoring operator", () => {
  const evidence = evaluateCanaryMonitoring({ evaluatedAtUtc, preflight, observation: observations() });
  assert.equal(evidence.monitoringOperatorId, preflight.monitoringOperatorId);

  for (const monitoringOperatorId of [undefined, "", "different-monitor"] as const) {
    assert.throws(
      () => evaluateCanaryMonitoring({
        evaluatedAtUtc,
        preflight,
        observation: { ...observations(), monitoringOperatorId },
      }),
      /observation.*approved monitoring operator/i,
    );
  }
});

test("canary monitoring rejects observations older than the approved health interval", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({
      preflight,
      observation: observations(),
      evaluatedAtUtc: "2026-11-24T09:00:30.001Z",
    }),
    /observation.*fresh|health interval/i,
  );
});

test("canary monitoring rejects observations dated after evaluation", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({
      preflight,
      observation: observations(),
      evaluatedAtUtc: "2026-11-24T08:59:59.999Z",
    }),
    /observation.*fresh|health interval/i,
  );
});
