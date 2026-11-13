import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateCanaryPlan } from "../../ops/canary/validate-canary-plan.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const validator = resolve(ROOT, "ops/canary/validate-canary-plan.mjs");
const commit = "a".repeat(40);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function approvedControlsSha256(plan: ReturnType<typeof validPlan>) {
  const controls = {
    releaseCommit: plan.releaseCommit,
    targetOrigin: plan.targetOrigin,
    window: plan.window,
    scope: plan.scope,
    monitoring: plan.monitoring,
    stopConditions: plan.stopConditions,
    rollback: plan.rollback,
  };
  return createHash("sha256").update(canonicalJson(controls)).digest("hex");
}

function validPlan() {
  const plan = {
    schemaVersion: 1,
    releaseCommit: commit,
    targetOrigin: "https://canary.orb.example",
    ownerApproval: {
      approved: true,
      realDataAuthorized: true,
      approverId: "orb-owner-01",
      approvedReleaseCommit: commit,
      approvedTargetOrigin: "https://canary.orb.example",
      approvedUatEvidenceSha256: "b".repeat(64),
      approvedPlanSha256: "",
      approvedAtUtc: "2026-11-23T08:00:00.000Z",
      expiresAtUtc: "2026-11-25T12:00:00.000Z",
    },
    window: { startsAtUtc: "2026-11-24T08:00:00.000Z", endsAtUtc: "2026-11-25T08:00:00.000Z" },
    scope: {
      maxUsers: 5,
      maxProjects: 3,
      userIds: ["pilot-user-01", "pilot-user-02"],
      projectIds: ["pilot-project-01"],
    },
    monitoring: {
      operatorId: "orb-monitor-01",
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
    rollback: { command: "ops/deploy/rollback.sh", maxMinutes: 5, operatorAssigned: true, operatorId: "orb-operator-01" },
  };
  plan.ownerApproval.approvedPlanSha256 = approvedControlsSha256(plan);
  return plan;
}

function validUat() {
  return {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    generatedAtUtc: "2026-11-23T07:45:00.000Z",
    reportStartedAtUtc: "2026-11-23T07:30:00.000Z",
    reportCompletedAtUtc: "2026-11-23T07:44:00.000Z",
    gitCommit: commit,
    targetOrigin: "https://canary.orb.example",
    reportSha256: "b".repeat(64),
    passed: true,
    ownerApprovalRecorded: false,
    locales: [
      { locale: "en", direction: "ltr", passed: true },
      { locale: "ar", direction: "rtl", passed: true },
    ],
  };
}

function run(plan = validPlan(), uat = validUat(), now = "2026-11-24T09:00:00.000Z") {
  try {
    const manifest = validateCanaryPlan({ plan, ownerUatEvidence: uat, nowUtc: now });
    return { status: 0, stdout: `${JSON.stringify(manifest)}\n`, stderr: "" };
  } catch (error) {
    return {
      status: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
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
    userIds: ["pilot-user-01", "pilot-user-02"],
    projectIds: ["pilot-project-01"],
    ownerApproved: true,
    ownerRealDataAuthorized: true,
    ownerApproverId: "orb-owner-01",
    monitoringOperatorId: "orb-monitor-01",
    rollbackOperatorId: "orb-operator-01",
    approvedUatEvidenceSha256: "b".repeat(64),
    approvedPlanSha256: approvedControlsSha256(validPlan()),
    uatReportStartedAtUtc: "2026-11-23T07:30:00.000Z",
    uatReportCompletedAtUtc: "2026-11-23T07:44:00.000Z",
    uatEvidenceGeneratedAtUtc: "2026-11-23T07:45:00.000Z",
    uatLocales: [
      { locale: "en", direction: "ltr", passed: true },
      { locale: "ar", direction: "rtl", passed: true },
    ],
    ownerApprovedAtUtc: "2026-11-23T08:00:00.000Z",
    ownerApprovalExpiresAtUtc: "2026-11-25T12:00:00.000Z",
    preflightGeneratedAtUtc: "2026-11-24T09:00:00.000Z",
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
    rollback: {
      command: "ops/deploy/rollback.sh",
      maxMinutes: 5,
      operatorId: "orb-operator-01",
    },
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

test("canary preflight requires an identified owner approver", () => {
  for (const approverId of [undefined, "", "   ", "owner name with spaces"]) {
    const plan = validPlan();
    plan.ownerApproval.approverId = approverId as string;
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /owner approval.*approver identity/i);
  }
});

test("canary preflight binds owner authorization to the exact release, target, and completed UAT", () => {
  const wrongRelease = validPlan();
  wrongRelease.ownerApproval.approvedReleaseCommit = "c".repeat(40);
  const wrongTarget = validPlan();
  wrongTarget.ownerApproval.approvedTargetOrigin = "https://other.orb.example";
  const wrongEvidence = validPlan();
  wrongEvidence.ownerApproval.approvedUatEvidenceSha256 = "c".repeat(64);
  const approvalBeforeUatCompleted = validPlan();
  approvalBeforeUatCompleted.ownerApproval.approvedAtUtc = "2026-11-23T07:40:00.000Z";

  for (const plan of [wrongRelease, wrongTarget, wrongEvidence, approvalBeforeUatCompleted]) {
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /owner approval|completed UAT/i);
  }
});

test("canary approval digest is canonical across JSON object key ordering", () => {
  const plan = validPlan();
  plan.scope = {
    projectIds: plan.scope.projectIds,
    userIds: plan.scope.userIds,
    maxProjects: plan.scope.maxProjects,
    maxUsers: plan.scope.maxUsers,
  };

  const result = run(plan);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("canary preflight binds owner authorization to the exact approved canary controls", () => {
  const plan = validPlan();
  plan.scope.userIds = ["replacement-pilot-user"];

  const result = run(plan);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner approval.*canary controls/i);
});

test("canary preflight requires a canonical UAT evidence digest", () => {
  const plan = validPlan();
  const uat = validUat();
  plan.ownerApproval.approvedUatEvidenceSha256 = "not-a-digest";
  uat.reportSha256 = "not-a-digest";
  const result = run(plan, uat);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UAT evidence/i);
});

test("canary preflight rejects future-dated owner approval", () => {
  const result = run(validPlan(), validUat(), "2026-11-23T07:50:00.000Z");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner approval.*future/i);
});

test("canary preflight requires owner approval strictly after UAT completion", () => {
  const plan = validPlan();
  plan.ownerApproval.approvedAtUtc = validUat().reportCompletedAtUtc;
  const result = run(plan);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner approval.*follow.*UAT/i);
});

test("canary preflight requires owner approval after a chronologically valid UAT evidence manifest", () => {
  const approvalBeforeEvidence = validUat();
  approvalBeforeEvidence.generatedAtUtc = "2026-11-23T08:01:00.000Z";
  const completionBeforeStart = validUat();
  completionBeforeStart.reportStartedAtUtc = "2026-11-23T07:45:00.000Z";

  for (const uat of [approvalBeforeEvidence, completionBeforeStart]) {
    const result = run(validPlan(), uat);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UAT.*chronology|owner approval.*evidence/i);
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

test("canary preflight rejects a canary scheduled beyond the bounded owner-approval horizon", () => {
  const plan = validPlan();
  plan.ownerApproval.expiresAtUtc = "2026-12-31T12:00:00.000Z";
  plan.window = { startsAtUtc: "2026-12-01T08:00:00.000Z", endsAtUtc: "2026-12-02T08:00:00.000Z" };

  const result = run(plan, validUat(), "2026-11-24T07:00:00.000Z");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner approval.*72 hours/i);
});

test("canary preflight rejects execution before the approved canary window opens", () => {
  const result = run(validPlan(), validUat(), "2026-11-24T07:59:59.999Z");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canary window.*not.*open/i);
});

test("canary preflight treats the window end and approval expiry as exclusive boundaries", () => {
  const atWindowEnd = run(validPlan(), validUat(), "2026-11-25T08:00:00.000Z");
  assert.notEqual(atWindowEnd.status, 0);
  assert.match(atWindowEnd.stderr, /canary window.*expired/i);

  const plan = validPlan();
  plan.window.endsAtUtc = plan.ownerApproval.expiresAtUtc;
  const atApprovalExpiry = run(plan, validUat(), plan.ownerApproval.expiresAtUtc);
  assert.notEqual(atApprovalExpiry.status, 0);
  assert.match(atApprovalExpiry.stderr, /owner approval.*expired/i);
});

test("canary preflight binds execution to an explicit unique pilot cohort and project set", () => {
  const cases = [
    Object.assign(validPlan(), { scope: { maxUsers: 5, maxProjects: 3, userIds: [], projectIds: ["pilot-project-01"] } }),
    Object.assign(validPlan(), { scope: { maxUsers: 5, maxProjects: 3, userIds: ["pilot-user-01"], projectIds: [] } }),
    Object.assign(validPlan(), { scope: { maxUsers: 1, maxProjects: 3, userIds: ["pilot-user-01", "pilot-user-02"], projectIds: ["pilot-project-01"] } }),
    Object.assign(validPlan(), { scope: { maxUsers: 5, maxProjects: 3, userIds: ["pilot-user-01", "pilot-user-01"], projectIds: ["pilot-project-01"] } }),
    Object.assign(validPlan(), { scope: { maxUsers: 5, maxProjects: 3, userIds: ["pilot user"], projectIds: ["pilot-project-01"] } }),
  ];

  for (const plan of cases) {
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /pilot.*user|pilot.*project|canary scope/i);
  }
});

test("canary preflight requires an identified monitoring operator", () => {
  for (const operatorId of [undefined, "", "   ", "monitor operator with spaces"]) {
    const plan = validPlan();
    plan.monitoring.operatorId = operatorId as string;
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /monitoring.*operator identity/i);
  }
});

test("canary preflight requires an identified rollback operator", () => {
  for (const operatorId of [undefined, "", "   "]) {
    const plan = validPlan();
    plan.rollback.operatorId = operatorId as string;
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback.*operator identity/i);
  }
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

test("canary preflight rejects unknown stop conditions instead of dropping them from the manifest", () => {
  const plan = validPlan();
  (plan.stopConditions as Record<string, boolean>).attachmentIsolationFailue = true;
  plan.ownerApproval.approvedPlanSha256 = approvedControlsSha256(plan);

  const result = run(plan);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown.*stop condition|stop condition.*unknown/i);
});

test("canary preflight rejects unknown approved control fields instead of silently omitting them", () => {
  const cases = [
    ["window", "endsAtUt"],
    ["scope", "maxProjectz"],
    ["monitoring", "maxErrorRatePercnt"],
    ["rollback", "maxMinutez"],
  ] as const;

  for (const [section, field] of cases) {
    const plan = validPlan();
    (plan[section] as Record<string, unknown>)[field] = 1;
    plan.ownerApproval.approvedPlanSha256 = approvedControlsSha256(plan);

    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown.*control|unknown.*field/i);
  }
});

test("canary preflight rejects unknown plan and owner-approval fields instead of silently omitting them", () => {
  const unknownPlanField = validPlan() as ReturnType<typeof validPlan> & Record<string, unknown>;
  unknownPlanField.deploymentMode = "unrestricted";

  const unknownApprovalField = validPlan();
  (unknownApprovalField.ownerApproval as typeof unknownApprovalField.ownerApproval & Record<string, unknown>).bypassReview = true;

  for (const plan of [unknownPlanField, unknownApprovalField]) {
    const result = run(plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown.*plan|unknown.*owner approval/i);
  }
});

test("canary preflight rejects unknown UAT evidence and locale fields instead of silently certifying them", () => {
  const unknownEvidenceField = validUat() as ReturnType<typeof validUat> & Record<string, unknown>;
  unknownEvidenceField.reviewMode = "owner-approved";

  const unknownLocaleField = validUat();
  (unknownLocaleField.locales[0] as typeof unknownLocaleField.locales[number] & Record<string, unknown>).reviewed = true;

  for (const uat of [unknownEvidenceField, unknownLocaleField]) {
    const result = run(validPlan(), uat);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown.*UAT evidence|unknown.*UAT locale/i);
  }
});

test("canary preflight CLI rejects caller-controlled clock overrides", () => {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-cli-clock-"));
  const planPath = join(directory, "plan.json");
  const uatPath = join(directory, "uat.json");
  writeFileSync(planPath, JSON.stringify(validPlan()));
  writeFileSync(uatPath, JSON.stringify(validUat()));

  const result = spawnSync(process.execPath, [
    validator,
    "--plan", planPath,
    "--uat-evidence", uatPath,
    "--now", "2026-11-24T09:00:00.000Z",
  ], { cwd: ROOT, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument|clock override|--now/i);
});
