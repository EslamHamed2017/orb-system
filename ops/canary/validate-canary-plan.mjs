#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_STOPS = [
  "permissionBypass",
  "attachmentIsolationFailure",
  "dataIntegrityFailure",
  "readinessThresholdExceeded",
  "errorRateThresholdExceeded",
  "latencyThresholdExceeded",
];

function canonicalTime(value, label) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value)
    throw new Error(`${label} must be canonical UTC ISO-8601`);
  return parsed;
}

function exactHttpsOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a credential-free HTTPS origin`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin !== value)
    throw new Error(`${label} must be a credential-free HTTPS origin`);
  return url.origin;
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${label} is outside the controlled canary scope`);
}

export function validateCanaryPlan({ plan, ownerUatEvidence, nowUtc = new Date().toISOString() }) {
  if (!plan || plan.schemaVersion !== 1) throw new Error("canary plan schemaVersion must be 1");
  if (!SHA1.test(plan.releaseCommit ?? "")) throw new Error("canary releaseCommit must be a full lowercase SHA-1");
  const targetOrigin = exactHttpsOrigin(plan.targetOrigin, "canary targetOrigin");
  const uat = ownerUatEvidence;

  if (plan.ownerApproval?.approved !== true) throw new Error("explicit owner approval is required");
  if (plan.ownerApproval?.realDataAuthorized !== true) throw new Error("explicit owner real-data authorization is required");
  if (typeof plan.ownerApproval?.approverId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(plan.ownerApproval.approverId))
    throw new Error("owner approval requires an explicit approver identity");
  if (plan.ownerApproval?.approvedReleaseCommit !== plan.releaseCommit ||
      plan.ownerApproval?.approvedTargetOrigin !== targetOrigin ||
      !SHA256.test(plan.ownerApproval?.approvedUatEvidenceSha256 ?? "") ||
      plan.ownerApproval.approvedUatEvidenceSha256 !== uat?.reportSha256)
    throw new Error("owner approval must bind the exact canary release, target origin, and UAT evidence");
  const approvedAt = canonicalTime(plan.ownerApproval.approvedAtUtc, "owner approval time");
  const uatStarted = canonicalTime(uat?.reportStartedAtUtc, "UAT report start time");
  const uatCompleted = canonicalTime(uat?.reportCompletedAtUtc, "completed UAT time");
  const uatGenerated = canonicalTime(uat?.generatedAtUtc, "UAT evidence generation time");
  if (uatCompleted < uatStarted || uatGenerated < uatCompleted)
    throw new Error("UAT evidence chronology must order report start, completion, and manifest generation");
  if (approvedAt <= uatGenerated) throw new Error("owner approval must follow generated UAT evidence");
  const approvalExpires = canonicalTime(plan.ownerApproval.expiresAtUtc, "owner approval expiry");
  const now = canonicalTime(nowUtc, "current time");
  if (now < approvedAt) throw new Error("owner approval cannot be future-dated");
  if (now >= approvalExpires) throw new Error("owner approval has expired");

  const starts = canonicalTime(plan.window?.startsAtUtc, "canary window start");
  const ends = canonicalTime(plan.window?.endsAtUtc, "canary window end");
  const maximumCanaryDurationMs = 72 * 60 * 60 * 1000;
  if (starts < approvedAt || ends <= starts || ends > approvalExpires || ends.valueOf() - starts.valueOf() > maximumCanaryDurationMs)
    throw new Error("canary window must follow approval, fit its expiry, and be no longer than 72 hours");
  if (ends.valueOf() - approvedAt.valueOf() > maximumCanaryDurationMs)
    throw new Error("owner approval must bound canary execution to 72 hours");
  if (now < starts) throw new Error("canary window is not yet open");
  if (now >= ends) throw new Error("canary window has expired");

  boundedInteger(plan.scope?.maxUsers, 1, 5, "maxUsers");
  boundedInteger(plan.scope?.maxProjects, 1, 3, "maxProjects");

  const monitoring = plan.monitoring ?? {};
  if (typeof monitoring.operatorId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(monitoring.operatorId))
    throw new Error("canary monitoring requires an explicit operator identity");
  if (!Number.isInteger(monitoring.healthIntervalSeconds) || monitoring.healthIntervalSeconds < 15 || monitoring.healthIntervalSeconds > 60 ||
      typeof monitoring.maxErrorRatePercent !== "number" || monitoring.maxErrorRatePercent <= 0 || monitoring.maxErrorRatePercent > 1 ||
      !Number.isInteger(monitoring.maxP95LatencyMs) || monitoring.maxP95LatencyMs <= 0 || monitoring.maxP95LatencyMs > 2000 ||
      !Number.isInteger(monitoring.maxConsecutiveReadinessFailures) || monitoring.maxConsecutiveReadinessFailures < 1 || monitoring.maxConsecutiveReadinessFailures > 2)
    throw new Error("canary monitoring thresholds must satisfy the controlled pilot limits");

  for (const condition of REQUIRED_STOPS) {
    if (plan.stopConditions?.[condition] !== true)
      throw new Error(`mandatory canary stop condition is not enabled: ${condition}`);
  }

  if (plan.rollback?.command !== "ops/deploy/rollback.sh" || plan.rollback?.operatorAssigned !== true ||
      !Number.isInteger(plan.rollback?.maxMinutes) || plan.rollback.maxMinutes < 1 || plan.rollback.maxMinutes > 5)
    throw new Error("canary rollback must use the rehearsed command with an assigned operator and a five-minute maximum");
  if (typeof plan.rollback.operatorId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(plan.rollback.operatorId))
    throw new Error("canary rollback requires an explicit operator identity");

  const bilingual = Array.isArray(uat?.locales) && uat.locales.length === 2 &&
    uat.locales.some((entry) => entry?.locale === "en" && entry.direction === "ltr" && entry.passed === true) &&
    uat.locales.some((entry) => entry?.locale === "ar" && entry.direction === "rtl" && entry.passed === true);
  if (uat?.schemaVersion !== 1 || uat?.gate !== "owner-uat-technical-journey" || uat?.passed !== true || !bilingual ||
      uat?.gitCommit !== plan.releaseCommit || uat?.targetOrigin !== targetOrigin)
    throw new Error("canary plan is not bound to passing bilingual UAT evidence for the same release and target");

  return {
    schemaVersion: 1,
    gate: "controlled-canary-preflight",
    releaseCommit: plan.releaseCommit,
    targetOrigin,
    startsAtUtc: starts.toISOString(),
    endsAtUtc: ends.toISOString(),
    maxUsers: plan.scope.maxUsers,
    maxProjects: plan.scope.maxProjects,
    ownerApproverId: plan.ownerApproval.approverId,
    monitoringOperatorId: monitoring.operatorId,
    rollbackOperatorId: plan.rollback.operatorId,
    approvedUatEvidenceSha256: plan.ownerApproval.approvedUatEvidenceSha256,
    monitoring: {
      operatorId: monitoring.operatorId,
      healthIntervalSeconds: monitoring.healthIntervalSeconds,
      maxErrorRatePercent: monitoring.maxErrorRatePercent,
      maxP95LatencyMs: monitoring.maxP95LatencyMs,
      maxConsecutiveReadinessFailures: monitoring.maxConsecutiveReadinessFailures,
    },
    stopConditions: [...REQUIRED_STOPS],
    rollback: {
      command: plan.rollback.command,
      maxMinutes: plan.rollback.maxMinutes,
      operatorId: plan.rollback.operatorId,
    },
    passed: true,
  };
}

async function main(args) {
  const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const planPath = value("--plan");
  const evidencePath = value("--uat-evidence");
  const nowUtc = value("--now") ?? new Date().toISOString();
  if (!planPath || !evidencePath)
    throw new Error("Usage: validate-canary-plan.mjs --plan FILE --uat-evidence FILE [--now ISO_UTC]");
  const [plan, ownerUatEvidence] = await Promise.all([
    readFile(planPath, "utf8").then(JSON.parse),
    readFile(evidencePath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(validateCanaryPlan({ plan, ownerUatEvidence, nowUtc }), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
