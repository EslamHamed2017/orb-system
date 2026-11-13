import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCanaryMonitoring } from "../../ops/canary/evaluate-canary-monitoring.mjs";

const commit = "a".repeat(40);
const digest = "b".repeat(64);

const preflight = {
  schemaVersion: 1,
  gate: "controlled-canary-preflight",
  releaseCommit: commit,
  targetOrigin: "https://canary.orb.example",
  startsAtUtc: "2026-11-24T08:00:00.000Z",
  endsAtUtc: "2026-11-25T08:00:00.000Z",
  approvedPlanSha256: digest,
  approvedUatEvidenceSha256: "c".repeat(64),
  ownerApproved: true,
  ownerRealDataAuthorized: true,
  ownerApproverId: "orb-owner-01",
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
    observedAtUtc: "2026-11-24T09:00:00.000Z",
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
  const safe = evaluateCanaryMonitoring({ preflight, observation: observations() });
  assert.equal(safe.passed, true);

  for (const patch of [
    { readiness: false, consecutiveReadinessFailures: 3 },
    { errorRatePercent: 1.01 },
    { p95LatencyMs: 2001 },
  ]) {
    assert.throws(
      () => evaluateCanaryMonitoring({ preflight, observation: { ...observations(), ...patch } }),
      /mandatory canary stop condition/i,
    );
  }
});

test("passing canary monitoring evidence preserves approved controls and evaluated outcomes", () => {
  const evidence = evaluateCanaryMonitoring({ preflight, observation: observations() });

  assert.equal(evidence.approvedUatEvidenceSha256, preflight.approvedUatEvidenceSha256);
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
});

test("canary monitoring evidence fails closed on every immediate security and integrity stop", () => {
  for (const stop of ["permissionBypass", "attachmentIsolationFailure", "dataIntegrityFailure"] as const) {
    const observation = observations();
    observation.securityEvents[stop] = true;
    assert.throws(
      () => evaluateCanaryMonitoring({ preflight, observation }),
      /mandatory canary stop condition/i,
    );
  }
});

test("canary monitoring evidence rejects unsupported observation claims", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({
      preflight,
      observation: { ...observations(), operatorOverride: "unapproved-operator" },
    }),
    /unknown canary observation field: operatorOverride/i,
  );

  const observation = observations();
  Object.assign(observation.securityEvents, { attachmentScanPassed: true });
  assert.throws(
    () => evaluateCanaryMonitoring({ preflight, observation }),
    /unknown canary security event field: attachmentScanPassed/i,
  );
});

test("canary monitoring evidence requires the supported observation schema", () => {
  assert.throws(
    () => evaluateCanaryMonitoring({
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
      () => evaluateCanaryMonitoring({ preflight: { ...preflight, ...patch }, observation: observations() }),
      /approved canary safety controls/i,
    );
  }
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
      () => evaluateCanaryMonitoring({ preflight: { ...preflight, ...patch }, observation: observations() }),
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
      () => evaluateCanaryMonitoring({ preflight: candidate, observation: observations() }),
      /unknown approved canary (preflight|monitoring|rollback) field/i,
    );
  }
});
