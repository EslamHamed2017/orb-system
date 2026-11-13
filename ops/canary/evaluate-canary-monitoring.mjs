import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SECURITY_STOPS = [
  "permissionBypass",
  "attachmentIsolationFailure",
  "dataIntegrityFailure",
];
const REQUIRED_STOPS = [
  ...SECURITY_STOPS,
  "readinessThresholdExceeded",
  "errorRateThresholdExceeded",
  "latencyThresholdExceeded",
];
const MONITORING_EVIDENCE_FIELDS = [
  "schemaVersion",
  "gate",
  "releaseCommit",
  "targetOrigin",
  "maxUsers",
  "maxProjects",
  "userIds",
  "projectIds",
  "approvedPlanSha256",
  "approvedUatEvidenceSha256",
  "observationId",
  "observationIds",
  "sampleSequence",
  "previousMonitoringEvidenceSha256",
  "ownerApproved",
  "ownerRealDataAuthorized",
  "ownerApproverId",
  "ownerApprovedAtUtc",
  "ownerApprovalExpiresAtUtc",
  "uatReportStartedAtUtc",
  "uatReportCompletedAtUtc",
  "uatEvidenceGeneratedAtUtc",
  "uatLocales",
  "preflightGeneratedAtUtc",
  "observedAtUtc",
  "evaluatedAtUtc",
  "monitoringOperatorId",
  "monitoring",
  "stopConditions",
  "rollback",
  "readiness",
  "consecutiveReadinessFailures",
  "errorRatePercent",
  "p95LatencyMs",
  "securityEvents",
  "passed",
  "monitoringEvidenceSha256",
];
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function approvedControlsSha256(preflight) {
  const controls = {
    releaseCommit: preflight.releaseCommit,
    targetOrigin: preflight.targetOrigin,
    window: {
      startsAtUtc: preflight.startsAtUtc,
      endsAtUtc: preflight.endsAtUtc,
    },
    scope: {
      maxUsers: preflight.maxUsers,
      maxProjects: preflight.maxProjects,
      userIds: preflight.userIds,
      projectIds: preflight.projectIds,
    },
    monitoring: preflight.monitoring,
    stopConditions: Object.fromEntries(REQUIRED_STOPS.map((name) => [name, true])),
    rollback: {
      command: preflight.rollback?.command,
      maxMinutes: preflight.rollback?.maxMinutes,
      operatorAssigned: true,
      operatorId: preflight.rollback?.operatorId,
    },
  };
  return createHash("sha256").update(canonicalJson(controls)).digest("hex");
}

function canonicalTime(value, label) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value)
    throw new Error(`${label} must be canonical UTC ISO-8601`);
  return parsed;
}

function exactHttpsOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("canary target must be an exact HTTPS origin"); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.origin !== value)
    throw new Error("canary target must be an exact HTTPS origin");
  return url.origin;
}

function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be a finite non-negative number`);
  return value;
}

function rejectUnknownFields(value, allowedFields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.includes(field));
  if (unknownFields.length > 0)
    throw new Error(`unknown ${label} field: ${unknownFields.join(", ")}`);
}

function approvedCohortIds(value, maximum, label) {
  const identity = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum ||
      value.some((id) => typeof id !== "string" || !identity.test(id)) ||
      new Set(value).size !== value.length)
    throw new Error(`${label} must identify the approved pilot cohort`);
  return [...value];
}

function monitoringEvidenceSha256(evidence) {
  const { monitoringEvidenceSha256: _digest, ...payload } = evidence;
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function validateSampleChain({ observation, previousEvidence }) {
  const sequence = observation.sampleSequence;
  const previousDigest = observation.previousMonitoringEvidenceSha256;
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new Error("canary monitoring sample sequence must be a positive integer");
  if (sequence === 1) {
    if (previousDigest !== null || previousEvidence !== undefined)
      throw new Error("first monitoring sample must not claim previous monitoring evidence");
    return { sequence, previousDigest: null, observationIds: [observation.observationId] };
  }
  if (!previousEvidence || !SHA256.test(previousDigest ?? ""))
    throw new Error("canary monitoring sample chain requires previous monitoring evidence");
  rejectUnknownFields(previousEvidence, MONITORING_EVIDENCE_FIELDS, "previous canary monitoring evidence");
  if (previousEvidence.schemaVersion !== 1 ||
      previousEvidence.gate !== "controlled-canary-monitoring-evidence" ||
      previousEvidence.passed !== true ||
      previousEvidence.sampleSequence !== sequence - 1 ||
      previousEvidence.monitoringEvidenceSha256 !== previousDigest ||
      monitoringEvidenceSha256(previousEvidence) !== previousDigest)
    throw new Error("canary monitoring sample chain contains invalid or tampered previous monitoring evidence");
  const previousObservationIds = previousEvidence.observationIds;
  if (!Array.isArray(previousObservationIds) ||
      previousObservationIds.length !== sequence - 1 ||
      previousObservationIds.some((id) => typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(id)) ||
      previousObservationIds.at(-1) !== previousEvidence.observationId ||
      new Set(previousObservationIds).size !== previousObservationIds.length)
    throw new Error("canary monitoring sample chain observation identity history is invalid");
  if (previousObservationIds.includes(observation.observationId))
    throw new Error("canary monitoring sample chain observation identity was reused");
  return { sequence, previousDigest, observationIds: [...previousObservationIds, observation.observationId] };
}

export function evaluateCanaryMonitoring({ preflight, observation, evaluatedAtUtc, previousEvidence }) {
  rejectUnknownFields(observation, [
    "schemaVersion",
    "releaseCommit",
    "targetOrigin",
    "approvedPlanSha256",
    "observationId",
    "sampleSequence",
    "previousMonitoringEvidenceSha256",
    "observedAtUtc",
    "userIds",
    "projectIds",
    "monitoringOperatorId",
    "readiness",
    "consecutiveReadinessFailures",
    "errorRatePercent",
    "p95LatencyMs",
    "securityEvents",
  ], "canary observation");
  rejectUnknownFields(observation.securityEvents, SECURITY_STOPS, "canary security event");
  rejectUnknownFields(preflight, [
    "schemaVersion",
    "gate",
    "releaseCommit",
    "targetOrigin",
    "startsAtUtc",
    "endsAtUtc",
    "maxUsers",
    "maxProjects",
    "userIds",
    "projectIds",
    "approvedPlanSha256",
    "approvedUatEvidenceSha256",
    "ownerApproved",
    "ownerRealDataAuthorized",
    "ownerApproverId",
    "monitoringOperatorId",
    "uatReportStartedAtUtc",
    "uatReportCompletedAtUtc",
    "uatEvidenceGeneratedAtUtc",
    "uatLocales",
    "ownerApprovedAtUtc",
    "ownerApprovalExpiresAtUtc",
    "preflightGeneratedAtUtc",
    "monitoring",
    "rollbackOperatorId",
    "rollback",
    "stopConditions",
    "passed",
  ], "approved canary preflight");
  rejectUnknownFields(preflight.monitoring, [
    "operatorId",
    "healthIntervalSeconds",
    "maxErrorRatePercent",
    "maxP95LatencyMs",
    "maxConsecutiveReadinessFailures",
  ], "approved canary monitoring");
  rejectUnknownFields(preflight.rollback, [
    "command",
    "maxMinutes",
    "operatorId",
  ], "approved canary rollback");
  if (observation.schemaVersion !== 1)
    throw new Error("canary observation schemaVersion must be 1");
  const {
    sequence: sampleSequence,
    previousDigest: previousMonitoringEvidenceSha256,
    observationIds,
  } = validateSampleChain({ observation, previousEvidence });
  const observationId = observation.observationId;
  if (typeof observationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(observationId))
    throw new Error("canary observation identity must be a bounded immutable identifier");
  if (preflight?.schemaVersion !== 1 || preflight?.gate !== "controlled-canary-preflight" || preflight?.passed !== true)
    throw new Error("canary monitoring requires a passing controlled canary preflight");
  if (!SHA1.test(preflight.releaseCommit ?? "") || !SHA256.test(preflight.approvedPlanSha256 ?? ""))
    throw new Error("canary monitoring requires immutable approved preflight bindings");
  const targetOrigin = exactHttpsOrigin(preflight.targetOrigin);
  if (previousEvidence && (
      previousEvidence.releaseCommit !== preflight.releaseCommit ||
      previousEvidence.targetOrigin !== targetOrigin ||
      previousEvidence.approvedPlanSha256 !== preflight.approvedPlanSha256 ||
      previousEvidence.approvedUatEvidenceSha256 !== preflight.approvedUatEvidenceSha256))
    throw new Error("previous monitoring evidence must bind the exact approved canary and UAT evidence");
  if (observation?.releaseCommit !== preflight.releaseCommit ||
      observation?.targetOrigin !== targetOrigin ||
      observation?.approvedPlanSha256 !== preflight.approvedPlanSha256)
    throw new Error("canary observation must bind the exact approved preflight");

  const starts = canonicalTime(preflight.startsAtUtc, "canary window start");
  const ends = canonicalTime(preflight.endsAtUtc, "canary window end");
  if (ends.valueOf() - starts.valueOf() > 72 * 60 * 60 * 1000)
    throw new Error("approved canary window duration must not exceed 72 hours");
  if (!Number.isInteger(preflight.maxUsers) || preflight.maxUsers < 1 || preflight.maxUsers > 5 ||
      !Number.isInteger(preflight.maxProjects) || preflight.maxProjects < 1 || preflight.maxProjects > 3)
    throw new Error("approved pilot cohort limits are invalid");
  const userIds = approvedCohortIds(preflight.userIds, preflight.maxUsers, "pilot user IDs");
  const projectIds = approvedCohortIds(preflight.projectIds, preflight.maxProjects, "pilot project IDs");
  const observationCoversApprovedCohort =
    Array.isArray(observation.userIds) &&
    Array.isArray(observation.projectIds) &&
    observation.userIds.length === userIds.length &&
    observation.projectIds.length === projectIds.length &&
    observation.userIds.every((id, index) => id === userIds[index]) &&
    observation.projectIds.every((id, index) => id === projectIds[index]);
  if (!observationCoversApprovedCohort)
    throw new Error("canary observation must cover the exact approved pilot cohort");
  const observedAt = canonicalTime(observation?.observedAtUtc, "canary observation time");
  if (observedAt < starts || observedAt >= ends)
    throw new Error("canary observation must fall inside the approved window");
  if (previousEvidence) {
    const previousObservedAt = canonicalTime(previousEvidence.observedAtUtc, "previous canary observation time");
    const previousEvaluatedAt = canonicalTime(previousEvidence.evaluatedAtUtc, "previous canary evaluation time");
    if (previousObservedAt >= observedAt)
      throw new Error("canary monitoring sample sequence must advance observation time");
    if (previousEvaluatedAt >= observedAt)
      throw new Error("canary monitoring sample chain observation must follow predecessor evaluation");
  }

  const identity = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;
  const approvedAt = canonicalTime(preflight.ownerApprovedAtUtc, "owner approval time");
  const approvalExpires = canonicalTime(preflight.ownerApprovalExpiresAtUtc, "owner approval expiry");
  const preflightGenerated = canonicalTime(preflight.preflightGeneratedAtUtc, "canary preflight generation time");
  const uatStarted = canonicalTime(preflight.uatReportStartedAtUtc, "UAT report start time");
  const uatCompleted = canonicalTime(preflight.uatReportCompletedAtUtc, "UAT report completion time");
  const uatGenerated = canonicalTime(preflight.uatEvidenceGeneratedAtUtc, "UAT evidence generation time");
  const uatLocales = preflight.uatLocales;
  const uatEvidenceIsValid =
    uatCompleted >= uatStarted &&
    uatCompleted.valueOf() - uatStarted.valueOf() <= 30 * 60 * 1000 &&
    uatGenerated >= uatCompleted && uatGenerated < approvedAt &&
    Array.isArray(uatLocales) && uatLocales.length === 2 &&
    uatLocales.some((entry) => entry?.locale === "en" && entry.direction === "ltr" && entry.passed === true && Object.keys(entry).length === 3) &&
    uatLocales.some((entry) => entry?.locale === "ar" && entry.direction === "rtl" && entry.passed === true && Object.keys(entry).length === 3);
  if (!uatEvidenceIsValid)
    throw new Error("canary monitoring requires valid approved UAT evidence");

  const rollback = preflight.rollback ?? {};
  const authorizationIsValid =
    preflight.ownerApproved === true &&
    preflight.ownerRealDataAuthorized === true &&
    typeof preflight.ownerApproverId === "string" && identity.test(preflight.ownerApproverId) &&
    SHA256.test(preflight.approvedUatEvidenceSha256 ?? "") &&
    approvedAt <= starts && approvalExpires >= ends &&
    preflightGenerated >= starts && preflightGenerated < ends &&
    observedAt >= preflightGenerated &&
    typeof preflight.rollbackOperatorId === "string" && identity.test(preflight.rollbackOperatorId) &&
    rollback.command === "ops/deploy/rollback.sh" &&
    Number.isInteger(rollback.maxMinutes) && rollback.maxMinutes >= 1 && rollback.maxMinutes <= 5 &&
    rollback.operatorId === preflight.rollbackOperatorId;
  if (!authorizationIsValid)
    throw new Error("canary monitoring requires approved owner authorization and rollback accountability");
  if (approvedAt.valueOf() - uatGenerated.valueOf() > 24 * 60 * 60 * 1000)
    throw new Error("canary monitoring requires UAT evidence generated within 24 hours of owner approval");

  const monitoring = preflight.monitoring ?? {};
  const approvedStops = preflight.stopConditions;
  const controlsAreValid =
    typeof monitoring.operatorId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(monitoring.operatorId) &&
    preflight.monitoringOperatorId === monitoring.operatorId &&
    Number.isInteger(monitoring.healthIntervalSeconds) &&
    monitoring.healthIntervalSeconds >= 15 && monitoring.healthIntervalSeconds <= 60 &&
    typeof monitoring.maxErrorRatePercent === "number" &&
    Number.isFinite(monitoring.maxErrorRatePercent) &&
    monitoring.maxErrorRatePercent > 0 && monitoring.maxErrorRatePercent <= 1 &&
    Number.isInteger(monitoring.maxP95LatencyMs) &&
    monitoring.maxP95LatencyMs > 0 && monitoring.maxP95LatencyMs <= 2000 &&
    Number.isInteger(monitoring.maxConsecutiveReadinessFailures) &&
    monitoring.maxConsecutiveReadinessFailures >= 1 &&
    monitoring.maxConsecutiveReadinessFailures <= 2 &&
    Array.isArray(approvedStops) &&
    approvedStops.length === REQUIRED_STOPS.length &&
    REQUIRED_STOPS.every((stop) => approvedStops.includes(stop)) &&
    new Set(approvedStops).size === REQUIRED_STOPS.length;
  if (!controlsAreValid)
    throw new Error("canary monitoring requires valid approved canary safety controls");
  if (previousEvidence) {
    const previousAuthorizationIsExact =
      previousEvidence.ownerApproved === preflight.ownerApproved &&
      previousEvidence.ownerRealDataAuthorized === preflight.ownerRealDataAuthorized &&
      previousEvidence.ownerApproverId === preflight.ownerApproverId &&
      previousEvidence.ownerApprovedAtUtc === approvedAt.toISOString() &&
      previousEvidence.ownerApprovalExpiresAtUtc === approvalExpires.toISOString() &&
      previousEvidence.uatReportStartedAtUtc === uatStarted.toISOString() &&
      previousEvidence.uatReportCompletedAtUtc === uatCompleted.toISOString() &&
      previousEvidence.uatEvidenceGeneratedAtUtc === uatGenerated.toISOString() &&
      canonicalJson(previousEvidence.uatLocales) === canonicalJson([
        { locale: "en", direction: "ltr", passed: true },
        { locale: "ar", direction: "rtl", passed: true },
      ]) &&
      previousEvidence.preflightGeneratedAtUtc === preflightGenerated.toISOString();
    if (!previousAuthorizationIsExact)
      throw new Error("previous monitoring evidence must preserve the exact approved authorization");

    const previousControlsAreExact =
      previousEvidence.maxUsers === preflight.maxUsers &&
      previousEvidence.maxProjects === preflight.maxProjects &&
      canonicalJson(previousEvidence.userIds) === canonicalJson(userIds) &&
      canonicalJson(previousEvidence.projectIds) === canonicalJson(projectIds) &&
      previousEvidence.monitoringOperatorId === monitoring.operatorId &&
      canonicalJson(previousEvidence.monitoring) === canonicalJson(monitoring) &&
      canonicalJson(previousEvidence.stopConditions) === canonicalJson(approvedStops) &&
      canonicalJson(previousEvidence.rollback) === canonicalJson({
        command: rollback.command,
        maxMinutes: rollback.maxMinutes,
        operatorId: rollback.operatorId,
      });
    if (!previousControlsAreExact)
      throw new Error("previous monitoring evidence must preserve the exact approved safety controls");
  }
  if (previousEvidence) {
    const previousObservedAt = canonicalTime(previousEvidence.observedAtUtc, "previous canary observation time");
    const previousEvaluatedAt = canonicalTime(previousEvidence.evaluatedAtUtc, "previous canary evaluation time");
    const previousObservationAgeMs = previousEvaluatedAt.valueOf() - previousObservedAt.valueOf();
    const previousChronologyIsValid =
      previousObservedAt >= starts && previousObservedAt < ends &&
      previousObservedAt >= preflightGenerated &&
      previousEvaluatedAt >= starts && previousEvaluatedAt < ends &&
      previousEvaluatedAt < approvalExpires &&
      previousObservationAgeMs >= 0 &&
      previousObservationAgeMs <= monitoring.healthIntervalSeconds * 1000;
    if (!previousChronologyIsValid)
      throw new Error("previous monitoring evidence chronology must satisfy the approved window and health interval");

    const previousFailures = previousEvidence.consecutiveReadinessFailures;
    const previousErrorRate = previousEvidence.errorRatePercent;
    const previousLatency = previousEvidence.p95LatencyMs;
    const previousSecurityEvents = previousEvidence.securityEvents ?? {};
    const previousOutcomeIsValid =
      Number.isInteger(previousFailures) && previousFailures >= 0 &&
      previousEvidence.readiness === (previousFailures === 0) &&
      previousFailures <= monitoring.maxConsecutiveReadinessFailures &&
      typeof previousErrorRate === "number" && Number.isFinite(previousErrorRate) &&
      previousErrorRate >= 0 && previousErrorRate <= monitoring.maxErrorRatePercent &&
      typeof previousLatency === "number" && Number.isFinite(previousLatency) &&
      previousLatency >= 0 && previousLatency <= monitoring.maxP95LatencyMs &&
      Object.keys(previousSecurityEvents).length === SECURITY_STOPS.length &&
      SECURITY_STOPS.every((name) => previousSecurityEvents[name] === false);
    if (!previousOutcomeIsValid)
      throw new Error("previous monitoring evidence contains a mandatory stop condition breach");
  }
  if (approvedControlsSha256(preflight) !== preflight.approvedPlanSha256)
    throw new Error("canary monitoring requires the exact owner-approved control digest");
  if (observation.monitoringOperatorId !== monitoring.operatorId)
    throw new Error("canary observation must identify the exact approved monitoring operator");

  const evaluatedAt = canonicalTime(evaluatedAtUtc, "canary monitoring evaluation time");
  if (evaluatedAt < starts || evaluatedAt >= ends || evaluatedAt >= approvalExpires)
    throw new Error("canary monitoring evaluation must occur inside the approved window");
  const observationAgeMs = evaluatedAt.valueOf() - observedAt.valueOf();
  if (observationAgeMs < 0 || observationAgeMs > monitoring.healthIntervalSeconds * 1000)
    throw new Error("canary observation must be fresh within the approved health interval");

  const failures = observation?.consecutiveReadinessFailures;
  if (!Number.isInteger(failures) || failures < 0)
    throw new Error("consecutive readiness failures must be a non-negative integer");
  if (typeof observation.readiness !== "boolean" || (observation.readiness !== (failures === 0)))
    throw new Error("readiness state must match the consecutive failure count");

  const errorRate = finiteNumber(observation.errorRatePercent, "canary error rate");
  const latency = finiteNumber(observation.p95LatencyMs, "canary p95 latency");
  const securityEvents = observation.securityEvents ?? {};
  const securityBreach = SECURITY_STOPS.some((name) => securityEvents[name] !== false);
  if (failures > monitoring.maxConsecutiveReadinessFailures ||
      errorRate > monitoring.maxErrorRatePercent ||
      latency > monitoring.maxP95LatencyMs || securityBreach)
    throw new Error("mandatory canary stop condition was triggered");

  const evidence = {
    schemaVersion: 1,
    gate: "controlled-canary-monitoring-evidence",
    releaseCommit: preflight.releaseCommit,
    targetOrigin,
    maxUsers: preflight.maxUsers,
    maxProjects: preflight.maxProjects,
    userIds,
    projectIds,
    approvedPlanSha256: preflight.approvedPlanSha256,
    approvedUatEvidenceSha256: preflight.approvedUatEvidenceSha256,
    observationId,
    observationIds,
    sampleSequence,
    previousMonitoringEvidenceSha256,
    ownerApproved: preflight.ownerApproved,
    ownerRealDataAuthorized: preflight.ownerRealDataAuthorized,
    ownerApproverId: preflight.ownerApproverId,
    ownerApprovedAtUtc: approvedAt.toISOString(),
    ownerApprovalExpiresAtUtc: approvalExpires.toISOString(),
    uatReportStartedAtUtc: uatStarted.toISOString(),
    uatReportCompletedAtUtc: uatCompleted.toISOString(),
    uatEvidenceGeneratedAtUtc: uatGenerated.toISOString(),
    uatLocales: [
      { locale: "en", direction: "ltr", passed: true },
      { locale: "ar", direction: "rtl", passed: true },
    ],
    preflightGeneratedAtUtc: preflightGenerated.toISOString(),
    observedAtUtc: observedAt.toISOString(),
    evaluatedAtUtc: evaluatedAt.toISOString(),
    monitoringOperatorId: monitoring.operatorId,
    monitoring: {
      operatorId: monitoring.operatorId,
      healthIntervalSeconds: monitoring.healthIntervalSeconds,
      maxErrorRatePercent: monitoring.maxErrorRatePercent,
      maxP95LatencyMs: monitoring.maxP95LatencyMs,
      maxConsecutiveReadinessFailures: monitoring.maxConsecutiveReadinessFailures,
    },
    stopConditions: [...approvedStops],
    rollback: {
      command: rollback.command,
      maxMinutes: rollback.maxMinutes,
      operatorId: rollback.operatorId,
    },
    readiness: observation.readiness,
    consecutiveReadinessFailures: failures,
    errorRatePercent: errorRate,
    p95LatencyMs: latency,
    securityEvents: {
      permissionBypass: securityEvents.permissionBypass,
      attachmentIsolationFailure: securityEvents.attachmentIsolationFailure,
      dataIntegrityFailure: securityEvents.dataIntegrityFailure,
    },
    passed: true,
  };
  return {
    ...evidence,
    monitoringEvidenceSha256: monitoringEvidenceSha256(evidence),
  };
}


async function main(args) {
  const allowedArguments = new Set(["--preflight", "--observation", "--previous-evidence"]);
  const seenArguments = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const argument = args[index];
    if (!allowedArguments.has(argument) || args[index + 1] === undefined)
      throw new Error(`unknown argument or missing value: ${argument ?? "<missing>"}`);
    if (seenArguments.has(argument))
      throw new Error(`duplicate argument: ${argument}`);
    seenArguments.add(argument);
  }
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const preflightPath = value("--preflight");
  const observationPath = value("--observation");
  const previousEvidencePath = value("--previous-evidence");
  if (!preflightPath || !observationPath)
    throw new Error("Usage: evaluate-canary-monitoring.mjs --preflight FILE --observation FILE");

  const [preflight, observation, previousEvidence] = await Promise.all([
    readFile(preflightPath, "utf8").then(JSON.parse),
    readFile(observationPath, "utf8").then(JSON.parse),
    previousEvidencePath ? readFile(previousEvidencePath, "utf8").then(JSON.parse) : undefined,
  ]);
  const evidence = evaluateCanaryMonitoring({
    preflight,
    observation,
    evaluatedAtUtc: new Date().toISOString(),
    previousEvidence,
  });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
