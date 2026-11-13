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

export function evaluateCanaryMonitoring({ preflight, observation }) {
  rejectUnknownFields(observation, [
    "schemaVersion",
    "releaseCommit",
    "targetOrigin",
    "approvedPlanSha256",
    "observedAtUtc",
    "readiness",
    "consecutiveReadinessFailures",
    "errorRatePercent",
    "p95LatencyMs",
    "securityEvents",
  ], "canary observation");
  rejectUnknownFields(observation.securityEvents, SECURITY_STOPS, "canary security event");
  if (observation.schemaVersion !== 1)
    throw new Error("canary observation schemaVersion must be 1");
  if (preflight?.schemaVersion !== 1 || preflight?.gate !== "controlled-canary-preflight" || preflight?.passed !== true)
    throw new Error("canary monitoring requires a passing controlled canary preflight");
  if (!SHA1.test(preflight.releaseCommit ?? "") || !SHA256.test(preflight.approvedPlanSha256 ?? ""))
    throw new Error("canary monitoring requires immutable approved preflight bindings");
  const targetOrigin = exactHttpsOrigin(preflight.targetOrigin);
  if (observation?.releaseCommit !== preflight.releaseCommit ||
      observation?.targetOrigin !== targetOrigin ||
      observation?.approvedPlanSha256 !== preflight.approvedPlanSha256)
    throw new Error("canary observation must bind the exact approved preflight");

  const starts = canonicalTime(preflight.startsAtUtc, "canary window start");
  const ends = canonicalTime(preflight.endsAtUtc, "canary window end");
  const observedAt = canonicalTime(observation?.observedAtUtc, "canary observation time");
  if (observedAt < starts || observedAt >= ends)
    throw new Error("canary observation must fall inside the approved window");

  const identity = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/;
  const approvedAt = canonicalTime(preflight.ownerApprovedAtUtc, "owner approval time");
  const approvalExpires = canonicalTime(preflight.ownerApprovalExpiresAtUtc, "owner approval expiry");
  const preflightGenerated = canonicalTime(preflight.preflightGeneratedAtUtc, "canary preflight generation time");
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

  const monitoring = preflight.monitoring ?? {};
  const approvedStops = preflight.stopConditions;
  const controlsAreValid =
    typeof monitoring.operatorId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(monitoring.operatorId) &&
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

  return {
    schemaVersion: 1,
    gate: "controlled-canary-monitoring-evidence",
    releaseCommit: preflight.releaseCommit,
    targetOrigin,
    approvedPlanSha256: preflight.approvedPlanSha256,
    observedAtUtc: observedAt.toISOString(),
    monitoringOperatorId: monitoring.operatorId,
    readiness: observation.readiness,
    consecutiveReadinessFailures: failures,
    errorRatePercent: errorRate,
    p95LatencyMs: latency,
    passed: true,
  };
}
