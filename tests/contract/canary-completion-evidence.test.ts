import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeCanaryEvidence } from "../../ops/canary/finalize-canary-evidence.mjs";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function monitoringEvidence() {
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    gate: "controlled-canary-monitoring-evidence",
    releaseCommit: "a".repeat(40),
    targetOrigin: "https://canary.orb.example",
    startsAtUtc: "2026-11-12T08:00:00.000Z",
    endsAtUtc: "2026-11-13T08:00:00.000Z",
    approvedPlanSha256: "b".repeat(64),
    approvedUatEvidenceSha256: "c".repeat(64),
    preflightEvidenceSha256: "d".repeat(64),
    ownerApproverId: "orb-owner-01",
    ownerApprovalExpiresAtUtc: "2026-11-13T08:00:00.000Z",
    monitoring: { healthIntervalSeconds: 60 },
    observationId: "sample-003",
    observationIds: ["sample-001", "sample-002", "sample-003"],
    sampleSequence: 3,
    evaluatedAtUtc: "2026-11-12T10:00:00.000Z",
    passed: true,
  };
  evidence.monitoringEvidenceSha256 = sha256(evidence);
  return evidence;
}

function completion() {
  const evidence = monitoringEvidence();
  return {
    schemaVersion: 1,
    releaseCommit: evidence.releaseCommit,
    preflightEvidenceSha256: evidence.preflightEvidenceSha256,
    finalMonitoringEvidenceSha256: evidence.monitoringEvidenceSha256,
    completedAtUtc: "2026-11-12T10:00:30.000Z",
    ownerReviewed: true,
    ownerReviewerId: evidence.ownerApproverId,
    ownerReviewedAtUtc: "2026-11-12T10:05:00.000Z",
  };
}

test("canary completion binds fresh final monitoring evidence and post-walkthrough owner review", () => {
  const monitoring = monitoringEvidence();
  const result = finalizeCanaryEvidence({ monitoringEvidence: monitoring, completion: completion() });
  assert.equal(result.gate, "controlled-canary-completion-evidence");
  assert.equal(result.releaseCommit, monitoring.releaseCommit);
  assert.equal(result.sampleSequence, 3);
  assert.equal(result.ownerReviewed, true);
  assert.match(result.completionEvidenceSha256, /^[a-f0-9]{64}$/);
  const { completionEvidenceSha256: _digest, ...payload } = result;
  assert.equal(result.completionEvidenceSha256, sha256(payload));
});

test("canary completion rejects tampered or non-passing final monitoring evidence", () => {
  for (const patch of [{ passed: false }, { sampleSequence: 2 }, { evaluatedAtUtc: "2026-11-12T10:00:01.000Z" }]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: { ...monitoringEvidence(), ...patch }, completion: completion() }),
      /final monitoring evidence.*(passing|intact|chain)/i,
    );
  }
});

test("canary completion rejects stale or out-of-window closure", () => {
  for (const completedAtUtc of ["2026-11-12T10:01:00.001Z", "2026-11-13T08:00:00.000Z"]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), completedAtUtc } }),
      /completion.*(health interval|approved window)/i,
    );
  }
});

test("canary completion requires exact immutable release and evidence bindings", () => {
  for (const patch of [
    { releaseCommit: "f".repeat(40) },
    { preflightEvidenceSha256: "e".repeat(64) },
    { finalMonitoringEvidenceSha256: "f".repeat(64) },
  ]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), ...patch } }),
      /exact (release|preflight|final monitoring)/i,
    );
  }
});

test("canary completion rejects future-dated completion or owner review", () => {
  const now = new Date("2026-11-12T10:00:40.000Z");
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoringEvidence(),
      completion: { ...completion(), completedAtUtc: "2026-11-12T10:00:41.000Z", ownerReviewedAtUtc: "2026-11-12T10:00:41.000Z" },
      now,
    }),
    /completion and owner review must not be future-dated/i,
  );
  assert.throws(
    () => finalizeCanaryEvidence({
      monitoringEvidence: monitoringEvidence(),
      completion: { ...completion(), ownerReviewedAtUtc: "2026-11-12T10:00:41.000Z" },
      now,
    }),
    /completion and owner review must not be future-dated/i,
  );
  assert.equal(finalizeCanaryEvidence({
    monitoringEvidence: monitoringEvidence(), completion: completion(), now: new Date("2026-11-12T10:05:00.000Z"),
  }).passed, true);
});

test("canary completion requires owner review strictly after walkthrough completion", () => {
  for (const patch of [
    { ownerReviewed: false },
    { ownerReviewerId: "different-owner" },
    { ownerReviewedAtUtc: "2026-11-12T10:00:30.000Z" },
    { ownerReviewedAtUtc: "2026-11-12T10:00:29.999Z" },
  ]) {
    assert.throws(
      () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), ...patch } }),
      /owner review/i,
    );
  }
});

test("canary completion closes input envelopes", () => {
  assert.throws(
    () => finalizeCanaryEvidence({ monitoringEvidence: monitoringEvidence(), completion: { ...completion(), override: true } }),
    /unknown canary completion field/i,
  );
  assert.throws(
    () => finalizeCanaryEvidence({ monitoringEvidence: { ...monitoringEvidence(), override: true }, completion: completion() }),
    /unknown final monitoring evidence field/i,
  );
});


test("canary completion CLI emits certified evidence and rejects ambiguous inputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "orb-canary-completion-"));
  const monitoringPath = join(directory, "monitoring.json");
  const completionPath = join(directory, "completion.json");
  writeFileSync(monitoringPath, JSON.stringify(monitoringEvidence()));
  writeFileSync(completionPath, JSON.stringify(completion()));
  const cli = join(process.cwd(), "ops/canary/finalize-canary-evidence.mjs");

  const result = spawnSync(process.execPath, [cli, "--monitoring-evidence", monitoringPath, "--completion", completionPath], {
    cwd: process.cwd(), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).gate, "controlled-canary-completion-evidence");

  const duplicate = spawnSync(process.execPath, [
    cli, "--monitoring-evidence", monitoringPath, "--monitoring-evidence", monitoringPath, "--completion", completionPath,
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /duplicate argument/i);
});
