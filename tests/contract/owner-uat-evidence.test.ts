import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createOwnerUatEvidence, writeOwnerUatEvidence } from "../../scripts/owner-uat-evidence.mjs";

const commit = "8".repeat(40);
function report(status = "passed", titles = ["owner UAT technical journey exposes the P0 lifecycle in en", "owner UAT technical journey exposes the P0 lifecycle in ar"]) {
  return {
    suites: [{ title: "owner-uat.spec.ts", specs: titles.map((title) => ({
      title, ok: status === "passed", tests: [{ expectedStatus: "passed", results: [{ status }] }],
    })) }],
  };
}

test("owner UAT evidence binds a successful bilingual report without retaining sensitive URL data", () => {
  const bytes = Buffer.from(JSON.stringify(report()));
  const evidence = createOwnerUatEvidence({
    reportBytes: bytes,
    targetUrl: "https://uat.example.test/review?token=do-not-retain",
    gitCommit: commit,
    generatedAtUtc: "2026-11-12T10:00:00.000Z",
  });
  const { reportSha256, ...fixed } = evidence;
  assert.deepEqual(fixed, {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    generatedAtUtc: "2026-11-12T10:00:00.000Z",
    gitCommit: commit,
    targetOrigin: "https://uat.example.test",
    locales: [
      { locale: "en", direction: "ltr", passed: true },
      { locale: "ar", direction: "rtl", passed: true },
    ],
    passed: true,
    ownerApprovalRecorded: false,
  });
  assert.match(reportSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(evidence), /token|do-not-retain|\/review/);
});

test("owner UAT evidence fails closed on failed, missing, duplicated, or unexpected journeys", () => {
  const base = { targetUrl: "https://uat.example.test", gitCommit: commit, generatedAtUtc: "2026-11-12T10:00:00.000Z" };
  for (const value of [
    report("failed"),
    report("passed", ["owner UAT technical journey exposes the P0 lifecycle in en"]),
    report("passed", ["owner UAT technical journey exposes the P0 lifecycle in en", "owner UAT technical journey exposes the P0 lifecycle in en"]),
    report("passed", ["owner UAT technical journey exposes the P0 lifecycle in en", "owner UAT technical journey exposes the P0 lifecycle in ar", "unapproved extra test"]),
  ]) assert.throws(() => createOwnerUatEvidence({ ...base, reportBytes: Buffer.from(JSON.stringify(value)) }));
});

test("owner UAT evidence rejects a journey that passed only after a failed retry", () => {
  const value = report();
  value.suites[0].specs[0].tests[0].results = [{ status: "failed" }, { status: "passed" }];
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes: Buffer.from(JSON.stringify(value)),
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /did not pass/,
  );
});

test("owner UAT evidence is written once with owner-only permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orb-owner-uat-"));
  const path = join(directory, "manifest.json");
  const evidence = createOwnerUatEvidence({ reportBytes: Buffer.from(JSON.stringify(report())), targetUrl: "https://uat.example.test", gitCommit: commit });
  await writeOwnerUatEvidence(path, evidence);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), evidence);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(() => writeOwnerUatEvidence(path, evidence));
});
