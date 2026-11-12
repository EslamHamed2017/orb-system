#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const JOURNEYS = new Map([
  ["owner UAT technical journey exposes the P0 lifecycle in en", { locale: "en", direction: "ltr", passed: true }],
  ["owner UAT technical journey exposes the P0 lifecycle in ar", { locale: "ar", direction: "rtl", passed: true }],
]);

function allSpecs(suites, output = []) {
  if (!Array.isArray(suites)) throw new Error("Playwright report suites are missing");
  for (const suite of suites) {
    if (Array.isArray(suite?.specs)) output.push(...suite.specs);
    if (Array.isArray(suite?.suites)) allSpecs(suite.suites, output);
  }
  return output;
}

export function createOwnerUatEvidence({ reportBytes, targetUrl, gitCommit, generatedAtUtc = new Date().toISOString() }) {
  if (!Buffer.isBuffer(reportBytes) || reportBytes.length === 0) throw new Error("Playwright JSON report is required");
  if (!/^[a-f0-9]{40}$/.test(gitCommit ?? "")) throw new Error("gitCommit must be a full lowercase SHA-1");
  const generated = new Date(generatedAtUtc);
  if (!Number.isFinite(generated.valueOf()) || generated.toISOString() !== generatedAtUtc) throw new Error("generatedAtUtc must be canonical UTC ISO-8601");
  const target = new URL(targetUrl);
  if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash)
    throw new Error("owner UAT target must be a credential-free HTTPS origin");
  let report;
  try { report = JSON.parse(reportBytes.toString("utf8")); } catch { throw new Error("Playwright report must be valid JSON"); }
  if (!Array.isArray(report?.errors) || report.errors.length !== 0)
    throw new Error("owner UAT report contains report-level errors");
  const stats = report?.stats;
  if (stats?.expected !== JOURNEYS.size || stats?.unexpected !== 0 || stats?.flaky !== 0 || stats?.skipped !== 0)
    throw new Error("owner UAT report aggregate outcomes are not exactly two expected passes");
  const filteredProjects = report?.config?.filteredProjects;
  if (!Array.isArray(filteredProjects) || filteredProjects.length !== 1 || filteredProjects[0]?.name !== "chromium")
    throw new Error("owner UAT report must contain exactly the approved Chromium project");
  let reportTarget;
  try { reportTarget = new URL(filteredProjects[0]?.use?.baseURL); } catch { throw new Error("owner UAT report target must be a valid URL"); }
  if (reportTarget.protocol !== "https:" || reportTarget.username || reportTarget.password || reportTarget.pathname !== "/" || reportTarget.search || reportTarget.hash)
    throw new Error("owner UAT report target must be a credential-free HTTPS origin");
  if (reportTarget.origin !== target.origin) throw new Error("owner UAT report target origin does not match the certified target origin");
  const reportStarted = new Date(report?.stats?.startTime);
  const reportDuration = report?.stats?.duration;
  if (!Number.isFinite(reportStarted.valueOf()) || reportStarted.toISOString() !== report?.stats?.startTime ||
      !Number.isFinite(reportDuration) || reportDuration < 0)
    throw new Error("owner UAT report timing must be valid");
  const reportCompleted = new Date(reportStarted.valueOf() + reportDuration);
  if (reportCompleted > generated) throw new Error("owner UAT report cannot be future-dated");
  if (generated.valueOf() - reportCompleted.valueOf() > 15 * 60 * 1000)
    throw new Error("owner UAT report must be fresh when evidence is generated");
  const specs = allSpecs(report.suites);
  if (specs.length !== JOURNEYS.size) throw new Error("owner UAT report must contain exactly the approved bilingual journeys");
  const seen = new Set();
  for (const spec of specs) {
    if (!JOURNEYS.has(spec?.title) || seen.has(spec.title)) throw new Error("owner UAT report contains a missing, duplicate, or unexpected journey");
    seen.add(spec.title);
    if (spec.ok !== true || !Array.isArray(spec.tests) || spec.tests.length !== 1) throw new Error(`owner UAT journey did not pass: ${spec.title}`);
    const [test] = spec.tests;
    if (test.expectedStatus !== "passed" || !Array.isArray(test.results) || test.results.length !== 1 || test.results[0]?.status !== "passed")
      throw new Error(`owner UAT journey did not pass: ${spec.title}`);
  }
  for (const title of JOURNEYS.keys()) if (!seen.has(title)) throw new Error(`owner UAT journey is missing: ${title}`);
  return {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    generatedAtUtc,
    reportStartedAtUtc: reportStarted.toISOString(),
    reportCompletedAtUtc: reportCompleted.toISOString(),
    gitCommit,
    targetOrigin: target.origin,
    reportSha256: createHash("sha256").update(reportBytes).digest("hex"),
    locales: [...JOURNEYS.values()],
    passed: true,
    ownerApprovalRecorded: false,
  };
}

export async function writeOwnerUatEvidence(path, evidence) {
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

async function main(args) {
  const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const reportPath = value("--report");
  const outputPath = value("--output");
  const gitCommit = value("--git-commit");
  if (!reportPath || !outputPath || !gitCommit || !process.env.ORB_TEST_BASE_URL || !process.env.ORB_EXPECTED_RELEASE_COMMIT)
    throw new Error("Usage: owner-uat-evidence.mjs --report FILE --output FILE --git-commit SHA with ORB_TEST_BASE_URL and ORB_EXPECTED_RELEASE_COMMIT");
  if (gitCommit !== process.env.ORB_EXPECTED_RELEASE_COMMIT)
    throw new Error("owner UAT evidence commit does not match the commit tested by the browser journey");
  const reportBytes = await readFile(reportPath);
  await writeOwnerUatEvidence(outputPath, createOwnerUatEvidence({ reportBytes, targetUrl: process.env.ORB_TEST_BASE_URL, gitCommit }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
