import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");
const validator = resolve(ROOT, "ops/canary/validate-canary-plan.mjs");
const commit = "a".repeat(40);

function validPlan() {
  return {
    schemaVersion: 1,
    releaseCommit: commit,
    targetOrigin: "https://canary.orb.example",
    ownerApproval: {
      approved: true,
      realDataAuthorized: true,
      approvedAtUtc: "2026-11-23T08:00:00.000Z",
      expiresAtUtc: "2026-11-25T12:00:00.000Z",
    },
    window: { startsAtUtc: "2026-11-24T08:00:00.000Z", endsAtUtc: "2026-11-25T08:00:00.000Z" },
    scope: { maxUsers: 5, maxProjects: 3 },
    monitoring: {
      healthIntervalSeconds: 30,
      maxErrorRatePercent: 1,
      maxP95LatencyMs: 2000,
      maxConsecutiveReadinessFailures: 2,
    },
    stopConditions: {
      permissionBypass: true,
      attachmentIsolationFailure: true,
      dataIntegrityFailure: true,
      readinessThresholdExceeded: true,
      errorRateThresholdExceeded: true,
      latencyThresholdExceeded: true,
    },
    rollback: { command: "ops/deploy/rollback.sh", maxMinutes: 5, operatorAssigned: true },
  };
}

function validUat() {
  return {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    gitCommit: commit,
    targetOrigin: "https://canary.orb.example",
    passed: true,
    locales: [
      { locale: "en", direction: "ltr", passed: true },
      { locale: "ar", direction: "rtl", passed: true },
    ],
  };
}

function run(plan = validPlan(), uat = validUat(), now = "2026-11-24T07:00:00.000Z") {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-preflight-"));
  const planPath = join(directory, "plan.json");
  const uatPath = join(directory, "uat.json");
  writeFileSync(planPath, JSON.stringify(plan));
  writeFileSync(uatPath, JSON.stringify(uat));
  return spawnSync(process.execPath, [validator, "--plan", planPath, "--uat-evidence", uatPath, "--now", now], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("canary preflight accepts a tightly bounded owner-authorized plan bound to passing bilingual UAT", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(result.stdout);
  assert.deepEqual(manifest, {
    schemaVersion: 1,
    gate: "controlled-canary-preflight",
    releaseCommit: commit,
    targetOrigin: "https://canary.orb.example",
    startsAtUtc: "2026-11-24T08:00:00.000Z",
    endsAtUtc: "2026-11-25T08:00:00.000Z",
    maxUsers: 5,
    maxProjects: 3,
    passed: true,
  });
});

test("canary preflight rejects absent owner approval or real-data authorization", () => {
  for (const patch of [{ approved: false }, { realDataAuthorized: false }]) {
    const plan = validPlan();
    Object.assign(plan.ownerApproval, patch);
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /owner approval|real-data authorization/i);
  }
});

test("canary preflight rejects release or target drift from passing bilingual UAT", () => {
  for (const uat of [
    { ...validUat(), gitCommit: "b".repeat(40) },
    { ...validUat(), targetOrigin: "https://other.orb.example" },
    { ...validUat(), passed: false },
    { ...validUat(), locales: [{ locale: "en", direction: "ltr", passed: true }] },
  ]) {
    const result = run(validPlan(), uat);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UAT/i);
  }
});

test("canary preflight rejects over-broad scope, windows, or expired approval", () => {
  const cases = [
    Object.assign(validPlan(), { scope: { maxUsers: 6, maxProjects: 3 } }),
    Object.assign(validPlan(), { scope: { maxUsers: 5, maxProjects: 4 } }),
    Object.assign(validPlan(), { window: { startsAtUtc: "2026-11-24T08:00:00.000Z", endsAtUtc: "2026-11-28T08:00:00.000Z" } }),
  ];
  for (const plan of cases) {
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /scope|window/i);
  }
  const expired = run(validPlan(), validUat(), "2026-11-26T07:00:00.000Z");
  assert.notEqual(expired.status, 0);
  assert.match(expired.stderr, /expired/i);
});

test("canary preflight rejects missing stop conditions, weak monitoring, or unavailable rollback", () => {
  const missingStop = validPlan();
  missingStop.stopConditions.attachmentIsolationFailure = false;
  const weakMonitoring = validPlan();
  weakMonitoring.monitoring.maxErrorRatePercent = 2;
  const noRollback = validPlan();
  noRollback.rollback.operatorAssigned = false;
  for (const plan of [missingStop, weakMonitoring, noRollback]) {
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stop condition|monitoring|rollback/i);
  }
});
