#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;
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
    observationIds.at(-1) === monitoringEvidence.observationId;
  if (!chainIsIntact)
    throw new Error("final monitoring evidence must be passing with an intact sample chain");

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
  const completed = canonicalTime(completion.completedAtUtc, "canary completion time");
  const reviewed = canonicalTime(completion.ownerReviewedAtUtc, "owner review time");
  if (!(now instanceof Date) || !Number.isFinite(now.valueOf()))
    throw new Error("evaluation time must be a valid Date");
  if (completed > now || reviewed > now)
    throw new Error("canary completion and owner review must not be future-dated");
  const healthIntervalSeconds = monitoringEvidence.monitoring?.healthIntervalSeconds;
  if (!Number.isInteger(healthIntervalSeconds) || healthIntervalSeconds < 15 || healthIntervalSeconds > 60)
    throw new Error("final monitoring evidence must preserve the approved health interval");
  if (completed < starts || completed >= ends)
    throw new Error("canary completion must occur inside the approved window");
  if (completed < evaluated || completed.valueOf() - evaluated.valueOf() > healthIntervalSeconds * 1000)
    throw new Error("canary completion must follow final monitoring within the approved health interval");

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
    preflightEvidenceSha256: monitoringEvidence.preflightEvidenceSha256,
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
