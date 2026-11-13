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
  monitoring: {
    operatorId: "orb-monitor-01",
    healthIntervalSeconds: 30,
    maxErrorRatePercent: 1,
    maxP95LatencyMs: 2000,
    maxConsecutiveReadinessFailures: 2,
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
