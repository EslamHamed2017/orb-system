const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SECURITY_STOPS = [
  "permissionBypass",
  "attachmentIsolationFailure",
  "dataIntegrityFailure",
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

export function evaluateCanaryMonitoring({ preflight, observation }) {
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

  const monitoring = preflight.monitoring ?? {};
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
