import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createOwnerUatEvidence, parseOwnerUatEvidenceArgs, writeOwnerUatEvidence } from "../../scripts/owner-uat-evidence.mjs";

const commit = "8".repeat(40);
function report(
  status = "passed",
  titles = ["owner UAT technical journey exposes the P0 lifecycle in en", "owner UAT technical journey exposes the P0 lifecycle in ar"],
  baseURL = "https://uat.example.test",
  startTime = "2026-11-12T09:59:00.000Z",
  duration = 30_000,
) {
  return {
    config: { filteredProjects: [{ name: "chromium", use: { baseURL } }] },
    stats: { startTime, duration, expected: 2, skipped: 0, unexpected: 0, flaky: 0 },
    errors: [],
    suites: [{ title: "owner-uat.spec.ts", file: "owner-uat.spec.ts", specs: titles.map((title) => ({
      title, ok: status === "passed", tests: [{ projectName: "chromium", expectedStatus: "passed", results: [{ status, duration: 10_000, startTime }] }],
    })) }],
  };
}

test("owner UAT evidence binds a successful bilingual report without retaining sensitive URL data", () => {
  const bytes = Buffer.from(JSON.stringify(report()));
  const evidence = createOwnerUatEvidence({
    reportBytes: bytes,
    targetUrl: "https://uat.example.test/",
    gitCommit: commit,
    generatedAtUtc: "2026-11-12T10:00:00.000Z",
  });
  const { reportSha256, ...fixed } = evidence;
  assert.deepEqual(fixed, {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    generatedAtUtc: "2026-11-12T10:00:00.000Z",
    reportStartedAtUtc: "2026-11-12T09:59:00.000Z",
    reportCompletedAtUtc: "2026-11-12T09:59:30.000Z",
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

test("owner UAT evidence rejects any target that is not a credential-free HTTPS origin", () => {
  const reportBytes = Buffer.from(JSON.stringify(report()));
  for (const targetUrl of [
    "http://uat.example.test",
    "https://user:secret@uat.example.test",
    "https://uat.example.test/review",
    "https://uat.example.test/?token=secret",
    "https://uat.example.test/#review",
  ]) {
    assert.throws(
      () => createOwnerUatEvidence({ reportBytes, targetUrl, gitCommit: commit }),
      /credential-free HTTPS(?: origin)?/,
      `accepted unsafe evidence target ${targetUrl}`,
    );
  }
});

test("owner UAT evidence rejects approved journey titles reported by an unrelated suite", () => {
  for (const mutate of [
    (value: ReturnType<typeof report>) => { value.suites[0].title = "unrelated.spec.ts"; },
    (value: ReturnType<typeof report>) => { value.suites[0].file = "unrelated.spec.ts"; },
  ]) {
    const value = report();
    mutate(value);
    assert.throws(
      () => createOwnerUatEvidence({
        reportBytes: Buffer.from(JSON.stringify(value)),
        targetUrl: "https://uat.example.test",
        gitCommit: commit,
        generatedAtUtc: "2026-11-12T10:00:00.000Z",
      }),
      /approved owner UAT suite/i,
    );
  }
});

test("owner UAT evidence rejects journeys attributed to a non-approved browser project", () => {
  const value = report();
  value.suites[0].specs[0].tests[0].projectName = "firefox";
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes: Buffer.from(JSON.stringify(value)),
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /approved Chromium project/i,
  );
});

test("owner UAT evidence rejects a report recorded against a different target origin", () => {
  const reportBytes = Buffer.from(JSON.stringify(report("passed", undefined, "https://other.example.test")));
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes,
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /report target origin does not match/i,
  );
});

test("owner UAT evidence rejects stale or future-dated browser reports", () => {
  const base = { targetUrl: "https://uat.example.test", gitCommit: commit, generatedAtUtc: "2026-11-12T10:00:00.000Z" };
  for (const value of [
    report("passed", undefined, undefined, "2026-11-12T09:40:00.000Z", 30_000),
    report("passed", undefined, undefined, "2026-11-12T10:00:01.000Z", 1),
  ]) {
    assert.throws(
      () => createOwnerUatEvidence({ ...base, reportBytes: Buffer.from(JSON.stringify(value)) }),
      /fresh|future/i,
    );
  }
});

test("owner UAT evidence rejects a zero-duration browser report", () => {
  const value = report("passed", undefined, undefined, "2026-11-12T10:00:00.000Z", 0);
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes: Buffer.from(JSON.stringify(value)),
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /duration|positive/i,
  );
});

test("owner UAT evidence rejects missing, zero, or impossible journey durations", () => {
  const base = { targetUrl: "https://uat.example.test", gitCommit: commit, generatedAtUtc: "2026-11-12T10:00:00.000Z" };
  for (const duration of [undefined, 0, 30_001]) {
    const value = report();
    const result = value.suites[0].specs[0].tests[0].results[0] as { duration?: number };
    if (duration === undefined) delete result.duration;
    else result.duration = duration;
    assert.throws(
      () => createOwnerUatEvidence({ ...base, reportBytes: Buffer.from(JSON.stringify(value)) }),
      /journey duration/i,
    );
  }
});

test("owner UAT evidence rejects journey timing outside the certified report window", () => {
  const base = { targetUrl: "https://uat.example.test", gitCommit: commit, generatedAtUtc: "2026-11-12T10:00:00.000Z" };
  const missingStart = report();
  delete (missingStart.suites[0].specs[0].tests[0].results[0] as { startTime?: string }).startTime;
  const startsBeforeReport = report();
  startsBeforeReport.suites[0].specs[0].tests[0].results[0].startTime = "2026-11-12T09:58:59.999Z";
  const completesAfterReport = report();
  completesAfterReport.suites[0].specs[0].tests[0].results[0].startTime = "2026-11-12T09:59:25.000Z";

  for (const value of [missingStart, startsBeforeReport, completesAfterReport]) {
    assert.throws(
      () => createOwnerUatEvidence({ ...base, reportBytes: Buffer.from(JSON.stringify(value)) }),
      /journey timing/i,
    );
  }
});

test("owner UAT evidence rejects bilingual journeys reported out of the approved order", () => {
  const value = report();
  value.suites[0].specs.reverse();
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes: Buffer.from(JSON.stringify(value)),
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /approved bilingual journey order/i,
  );
});

test("owner UAT evidence rejects reports exceeding the bounded owner-review duration", () => {
  const value = report("passed", undefined, undefined, "2026-11-12T09:29:59.999Z", 30 * 60_000 + 1);
  assert.throws(
    () => createOwnerUatEvidence({
      reportBytes: Buffer.from(JSON.stringify(value)),
      targetUrl: "https://uat.example.test",
      gitCommit: commit,
      generatedAtUtc: "2026-11-12T10:00:00.000Z",
    }),
    /duration|30 minutes/i,
  );
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

test("owner UAT evidence rejects report-level errors or non-passing aggregate outcomes", () => {
  const base = { targetUrl: "https://uat.example.test", gitCommit: commit, generatedAtUtc: "2026-11-12T10:00:00.000Z" };
  const withGlobalError = report();
  withGlobalError.errors = [{ message: "global teardown failed" }];
  const withUnexpectedOutcome = report();
  withUnexpectedOutcome.stats.unexpected = 1;
  const withFlakyOutcome = report();
  withFlakyOutcome.stats.flaky = 1;
  const withSkippedOutcome = report();
  withSkippedOutcome.stats.skipped = 1;
  const withWrongExpectedCount = report();
  withWrongExpectedCount.stats.expected = 1;

  for (const value of [withGlobalError, withUnexpectedOutcome, withFlakyOutcome, withSkippedOutcome, withWrongExpectedCount]) {
    assert.throws(
      () => createOwnerUatEvidence({ ...base, reportBytes: Buffer.from(JSON.stringify(value)) }),
      /report-level errors|aggregate outcomes/i,
    );
  }
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
  const evidence = createOwnerUatEvidence({
    reportBytes: Buffer.from(JSON.stringify(report())),
    targetUrl: "https://uat.example.test",
    gitCommit: commit,
    generatedAtUtc: "2026-11-12T10:00:00.000Z",
  });
  await writeOwnerUatEvidence(path, evidence);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), evidence);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(() => writeOwnerUatEvidence(path, evidence));
});


test("owner UAT evidence CLI rejects unknown and duplicate flags", () => {
  assert.throws(
    () => parseOwnerUatEvidenceArgs([
      "--report", "report.json",
      "--output", "manifest.json",
      "--git-commit", commit,
      "--unexpected", "value",
    ]),
    /unknown owner UAT evidence argument/i,
  );
  assert.throws(
    () => parseOwnerUatEvidenceArgs([
      "--report", "report.json",
      "--report", "substituted.json",
      "--output", "manifest.json",
      "--git-commit", commit,
    ]),
    /duplicate owner UAT evidence argument/i,
  );
});
