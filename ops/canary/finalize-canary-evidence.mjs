#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;
const SECURITY_STOPS = ["permissionBypass", "attachmentIsolationFailure", "dataIntegrityFailure"];
const REQUIRED_STOPS = [
  ...SECURITY_STOPS,
  "readinessThresholdExceeded",
  "errorRateThresholdExceeded",
  "latencyThresholdExceeded",
];
const COMPLETION_FIELDS = [
  "schemaVersion", "releaseCommit", "preflightEvidenceSha256",
  "finalMonitoringEvidenceSha256", "completedAtUtc", "ownerReviewed",
  "ownerReviewerId", "ownerReviewedAtUtc",
];
const MONITORING_EVIDENCE_FIELDS = [
  "schemaVersion", "gate", "releaseCommit", "targetOrigin", "startsAtUtc", "endsAtUtc",
  "maxUsers", "maxProjects", "userIds", "projectIds", "approvedPlanSha256",
  "approvedUatEvidenceSha256", "preflightEvidenceSha256", "observationId", "observationIds",
  "sampleSequence", "previousMonitoringEvidenceSha256", "previousMonitoringEvidenceSha256s",
  "ownerApproved", "ownerRealDataAuthorized", "ownerApproverId", "ownerApprovedAtUtc",
  "ownerApprovalExpiresAtUtc", "uatReportStartedAtUtc", "uatReportCompletedAtUtc",
  "uatEvidenceGeneratedAtUtc", "uatLocales", "preflightGeneratedAtUtc", "observedAtUtc",
  "evaluatedAtUtc", "monitoringOperatorId", "monitoring", "stopConditions", "rollback",
  "readiness", "consecutiveReadinessFailures", "errorRatePercent", "p95LatencyMs",
  "securityEvents", "passed", "monitoringEvidenceSha256",
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value, digestField) {
  const payload = { ...value };
  delete payload[digestField];
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function rejectUnknownFields(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  const unknown = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unknown.length) throw new Error(`unknown ${label} field: ${unknown.join(", ")}`);
}

function canonicalTime(value, label) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value)
    throw new Error(`${label} must be canonical UTC ISO-8601`);
  return parsed;
}

export function finalizeCanaryEvidence({ monitoringEvidence, completion, now = new Date() }) {
  rejectUnknownFields(monitoringEvidence, MONITORING_EVIDENCE_FIELDS, "final monitoring evidence");
  rejectUnknownFields(completion, COMPLETION_FIELDS, "canary completion");

  const monitoringDigest = monitoringEvidence.monitoringEvidenceSha256;
  const sequence = monitoringEvidence.sampleSequence;
  const observationIds = monitoringEvidence.observationIds;
  const previousDigest = monitoringEvidence.previousMonitoringEvidenceSha256;
  const previousDigests = monitoringEvidence.previousMonitoringEvidenceSha256s;
  const chainIsIntact =
    monitoringEvidence.schemaVersion === 1 &&
    monitoringEvidence.gate === "controlled-canary-monitoring-evidence" &&
    monitoringEvidence.passed === true &&
    SHA256.test(monitoringDigest ?? "") &&
    digest(monitoringEvidence, "monitoringEvidenceSha256") === monitoringDigest &&
    Number.isInteger(sequence) && sequence >= 1 &&
    Array.isArray(observationIds) && observationIds.length === sequence &&
    observationIds.every((id) => typeof id === "string" && IDENTITY.test(id)) &&
    new Set(observationIds).size === observationIds.length &&
    observationIds.at(-1) === monitoringEvidence.observationId &&
    ((sequence === 1 && previousDigest === null) ||
      (sequence > 1 && SHA256.test(previousDigest ?? ""))) &&
    Array.isArray(previousDigests) &&
    previousDigests.length === sequence - 1 &&
    previousDigests.every((entry) => SHA256.test(entry ?? "")) &&
    new Set(previousDigests).size === previousDigests.length &&
    (sequence === 1 || previousDigests.at(-1) === previousDigest);
  if (!chainIsIntact)
    throw new Error("final monitoring evidence must be passing with an intact sample chain");
  if (monitoringEvidence.ownerApproved !== true || monitoringEvidence.ownerRealDataAuthorized !== true)
    throw new Error("final monitoring evidence must preserve owner approval and real-data authorization");
  if (!SHA256.test(monitoringEvidence.approvedUatEvidenceSha256 ?? ""))
    throw new Error("final monitoring evidence must preserve the approved UAT evidence digest");

  const maxUsers = monitoringEvidence.maxUsers;
  const maxProjects = monitoringEvidence.maxProjects;
  const userIds = monitoringEvidence.userIds;
  const projectIds = monitoringEvidence.projectIds;
  const validIdSet = (ids, maximum) =>
    Array.isArray(ids) && ids.length >= 1 && ids.length <= maximum &&
    ids.every((id) => typeof id === "string" && IDENTITY.test(id)) &&
    new Set(ids).size === ids.length;
  const pilotScopeIsValid =
    Number.isInteger(maxUsers) && maxUsers >= 1 && maxUsers <= 5 &&
    Number.isInteger(maxProjects) && maxProjects >= 1 && maxProjects <= 3 &&
    validIdSet(userIds, maxUsers) && validIdSet(projectIds, maxProjects);
  if (!pilotScopeIsValid)
    throw new Error("final monitoring evidence must preserve a valid approved pilot scope");

  const monitoring = monitoringEvidence.monitoring;
  const failures = monitoringEvidence.consecutiveReadinessFailures;
  const securityEvents = monitoringEvidence.securityEvents;
  const finiteNonNegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const finalOutcomeIsSafe =
    monitoring && typeof monitoring === "object" && !Array.isArray(monitoring) &&
    Number.isInteger(monitoring.maxConsecutiveReadinessFailures) &&
    monitoring.maxConsecutiveReadinessFailures >= 0 &&
    finiteNonNegative(monitoring.maxErrorRatePercent) &&
    finiteNonNegative(monitoring.maxP95LatencyMs) &&
    Array.isArray(monitoringEvidence.stopConditions) &&
    monitoringEvidence.stopConditions.length === REQUIRED_STOPS.length &&
    REQUIRED_STOPS.every((name) => monitoringEvidence.stopConditions.includes(name)) &&
    Number.isInteger(failures) && failures >= 0 &&
    monitoringEvidence.readiness === (failures === 0) &&
    failures <= monitoring.maxConsecutiveReadinessFailures &&
    finiteNonNegative(monitoringEvidence.errorRatePercent) &&
    monitoringEvidence.errorRatePercent <= monitoring.maxErrorRatePercent &&
    finiteNonNegative(monitoringEvidence.p95LatencyMs) &&
    monitoringEvidence.p95LatencyMs <= monitoring.maxP95LatencyMs &&
    securityEvents && typeof securityEvents === "object" && !Array.isArray(securityEvents) &&
    Object.keys(securityEvents).length === SECURITY_STOPS.length &&
    SECURITY_STOPS.every((name) => securityEvents[name] === false);
  if (!finalOutcomeIsSafe)
    throw new Error("final monitoring evidence contains a mandatory stop condition breach");

  if (completion.schemaVersion !== 1)
    throw new Error("canary completion schemaVersion must be 1");
  if (!SHA1.test(completion.releaseCommit ?? "") || completion.releaseCommit !== monitoringEvidence.releaseCommit)
    throw new Error("canary completion must bind the exact release");
  if (!SHA256.test(completion.preflightEvidenceSha256 ?? "") ||
      completion.preflightEvidenceSha256 !== monitoringEvidence.preflightEvidenceSha256)
    throw new Error("canary completion must bind the exact preflight");
  if (!SHA256.test(completion.finalMonitoringEvidenceSha256 ?? "") ||
      completion.finalMonitoringEvidenceSha256 !== monitoringDigest)
    throw new Error("canary completion must bind the exact final monitoring evidence");

  const starts = canonicalTime(monitoringEvidence.startsAtUtc, "approved canary window start");
  const ends = canonicalTime(monitoringEvidence.endsAtUtc, "approved canary window end");
  const evaluated = canonicalTime(monitoringEvidence.evaluatedAtUtc, "final monitoring evaluation time");
  const approved = canonicalTime(monitoringEvidence.ownerApprovedAtUtc, "owner approval time");
  const authorizationExpires = canonicalTime(
    monitoringEvidence.ownerApprovalExpiresAtUtc,
    "owner authorization expiry",
  );
  const preflightGenerated = canonicalTime(
    monitoringEvidence.preflightGeneratedAtUtc,
    "canary preflight generation time",
  );
  const completed = canonicalTime(completion.completedAtUtc, "canary completion time");
  const reviewed = canonicalTime(completion.ownerReviewedAtUtc, "owner review time");
  if (!(now instanceof Date) || !Number.isFinite(now.valueOf()))
    throw new Error("evaluation time must be a valid Date");
  if (completed > now || reviewed > now)
    throw new Error("canary completion and owner review must not be future-dated");
  const healthIntervalSeconds = monitoringEvidence.monitoring?.healthIntervalSeconds;
  if (!Number.isInteger(healthIntervalSeconds) || healthIntervalSeconds < 15 || healthIntervalSeconds > 60)
    throw new Error("final monitoring evidence must preserve the approved health interval");
  if (evaluated < starts || evaluated >= ends)
    throw new Error("final monitoring evaluation must occur inside the approved window");
  if (approved >= preflightGenerated || approved >= authorizationExpires || preflightGenerated > evaluated)
    throw new Error("final monitoring evidence has invalid owner authorization chronology");
  if (completed < starts || completed >= ends)
    throw new Error("canary completion must occur inside the approved window");
  if (completed < evaluated || completed.valueOf() - evaluated.valueOf() > healthIntervalSeconds * 1000)
    throw new Error("canary completion must follow final monitoring within the approved health interval");
  if (reviewed >= ends)
    throw new Error("owner review must occur inside the approved window");
  if (reviewed >= authorizationExpires)
    throw new Error("owner review must occur before owner authorization expires");

  const ownerReviewIsValid =
    completion.ownerReviewed === true &&
    typeof completion.ownerReviewerId === "string" &&
    IDENTITY.test(completion.ownerReviewerId) &&
    completion.ownerReviewerId === monitoringEvidence.ownerApproverId &&
    reviewed > completed;
  if (!ownerReviewIsValid)
    throw new Error("canary completion requires owner review after walkthrough completion");

  const evidence = {
    schemaVersion: 1,
    gate: "controlled-canary-completion-evidence",
    releaseCommit: monitoringEvidence.releaseCommit,
    targetOrigin: monitoringEvidence.targetOrigin,
    startsAtUtc: starts.toISOString(),
    endsAtUtc: ends.toISOString(),
    maxUsers: monitoringEvidence.maxUsers,
    maxProjects: monitoringEvidence.maxProjects,
    userIds: [...monitoringEvidence.userIds],
    projectIds: [...monitoringEvidence.projectIds],
    ownerApproverId: monitoringEvidence.ownerApproverId,
    ownerApprovedAtUtc: approved.toISOString(),
    ownerApprovalExpiresAtUtc: authorizationExpires.toISOString(),
    preflightEvidenceSha256: monitoringEvidence.preflightEvidenceSha256,
    approvedUatEvidenceSha256: monitoringEvidence.approvedUatEvidenceSha256,
    finalMonitoringEvidenceSha256: monitoringDigest,
    sampleSequence: sequence,
    observationIds: [...observationIds],
    completedAtUtc: completed.toISOString(),
    ownerReviewed: true,
    ownerReviewerId: completion.ownerReviewerId,
    ownerReviewedAtUtc: reviewed.toISOString(),
    passed: true,
  };
  return { ...evidence, completionEvidenceSha256: digest(evidence, "completionEvidenceSha256") };
}

async function main(args) {
  const allowed = new Set(["--monitoring-evidence", "--completion"]);
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || value === undefined) throw new Error(`unknown argument or missing value: ${name ?? "<missing>"}`);
    if (values.has(name)) throw new Error(`duplicate argument: ${name}`);
    values.set(name, value);
  }
  if (!values.has("--monitoring-evidence") || !values.has("--completion"))
    throw new Error("Usage: finalize-canary-evidence.mjs --monitoring-evidence FILE --completion FILE");
  const [monitoringEvidence, completion] = await Promise.all([
    readFile(values.get("--monitoring-evidence"), "utf8").then(JSON.parse),
    readFile(values.get("--completion"), "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(finalizeCanaryEvidence({ monitoringEvidence, completion }), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
