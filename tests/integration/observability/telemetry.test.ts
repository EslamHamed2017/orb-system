import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MetricsRegistry } from "../../../src/platform/observability/metrics.ts";
import { InMemoryTraceSink, traceOperation } from "../../../src/platform/observability/tracing.ts";
import { IncidentLog } from "../../../src/platform/observability/incident-log.ts";
import { createLivenessHandler } from "../../../src/app/api/health/live/route.ts";
import { createReadinessHandler } from "../../../src/app/api/health/ready/route.ts";

const correlationId = "corr-00000000-0000-4000-8000-000000000007";
const auditEventId = "audit-00000000-0000-4000-8000-000000000009";

test("metrics cover mutation latency, jobs, sends, backup, restore, audit and dependencies without labels that leak values", () => {
  const metrics = new MetricsRegistry();
  metrics.observeMutation({ operationId: "confirmSalesShipment", durationMs: 175, outcome: "success" });
  metrics.recordJob({ job: "document-generation", outcome: "failed" });
  metrics.recordSendFailure("smtp");
  metrics.setBackupLagMinutes(14);
  metrics.observeRestoreMinutes(230);
  metrics.setAuditChainHealthy(false);
  metrics.setDependencyHealthy("database", false);
  const snapshot = metrics.snapshot();
  assert.deepEqual(snapshot.mutationLatencyMs.confirmSalesShipment.success, [175]);
  assert.equal(snapshot.jobRuns["document-generation"].failed, 1);
  assert.equal(snapshot.sendFailures.smtp, 1);
  assert.equal(snapshot.backupLagMinutes, 14);
  assert.deepEqual(snapshot.restoreMinutes, [230]);
  assert.equal(snapshot.auditChainHealthy, 0);
  assert.equal(snapshot.dependencies.database, 0);
  assert.doesNotMatch(JSON.stringify(snapshot), /password|secret|token|cookie|authorization/i);
  assert.throws(() => metrics.setDependencyHealthy("db-password", true), /metric label/);
});

test("traces retain correlation and audit IDs while recursively redacting secrets and identities", async () => {
  const sink = new InMemoryTraceSink();
  const result = await traceOperation(sink, {
    name: "confirmSalesShipment", correlationId, auditEventId,
    attributes: { projectId: "PROJECT-7", password: "never-log", actor: { email: "owner@example.test" } },
  }, async (span) => { span.event("approval-bound", { csrfToken: "also-secret", state: "CONFIRMED" }); return 204; });
  assert.equal(result, 204);
  const [span] = sink.snapshot();
  assert.equal(span.correlationId, correlationId);
  assert.equal(span.auditEventId, auditEventId);
  assert.equal(span.status, "OK");
  assert.equal((span.attributes as any).password, "[REDACTED]");
  assert.equal((span.attributes as any).actor, "[REDACTED]");
  assert.equal((span.events[0].attributes as any).csrfToken, "[REDACTED]");
});

test("failed traces and append-only incident records remain correlated and safe", async () => {
  const sink = new InMemoryTraceSink();
  await assert.rejects(traceOperation(sink, { name: "sendManifest", correlationId, attributes: { authorization: "Bearer hidden" } }, async () => { throw new Error("SMTP password=hidden"); }), /SMTP/);
  assert.equal(sink.snapshot()[0].status, "ERROR");
  assert.doesNotMatch(JSON.stringify(sink.snapshot()), /hidden/);
  const incidents = new IncidentLog(() => "2026-11-07T12:00:00.000Z");
  const saved = incidents.append({ kind: "SEND_FAILURE", correlationId, auditEventId, severity: "HIGH", details: { sessionToken: "hidden", provider: "smtp" } });
  assert.equal(saved.sequence, 1);
  assert.equal(saved.correlationId, correlationId);
  assert.equal((saved.details as any).sessionToken, "[REDACTED]");
  assert.throws(() => Object.assign(saved, { severity: "LOW" }), TypeError);
});

test("health handlers distinguish process liveness from dependency and audit readiness", async () => {
  const live = await createLivenessHandler(() => "2026-11-07T12:00:00.000Z")();
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "live", checkedAt: "2026-11-07T12:00:00.000Z" });
  const ready = createReadinessHandler({ database: async () => true, objectStorage: async () => false, auditChain: async () => true }, () => "2026-11-07T12:00:00.000Z", "0123456789abcdef0123456789abcdef01234567");
  const response = await ready();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "not-ready", checkedAt: "2026-11-07T12:00:00.000Z", checks: { auditChain: "up", database: "up", objectStorage: "down" }, release: { gitCommit: "0123456789abcdef0123456789abcdef01234567" } });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("alert policy encodes the accepted RPO, restore, job, send, audit and dependency thresholds", () => {
  const policy = readFileSync(resolve(process.cwd(), "ops/observability/alerts.yml"), "utf8");
  for (const alert of ["OrbBackupRpoExceeded", "OrbRestoreRtoExceeded", "OrbJobFailure", "OrbOutboundSendFailure", "OrbAuditChainFailure", "OrbDependencyOutage"]) assert.match(policy, new RegExp(`alert: ${alert}`));
  assert.match(policy, /orb_backup_lag_minutes > 15/);
  assert.match(policy, /orb_restore_duration_minutes > 240/);
  assert.match(policy, /orb_job_failures_total > 0/);
  assert.match(policy, /orb_dependency_healthy == 0/);
});
