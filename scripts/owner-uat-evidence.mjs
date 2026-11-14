#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const JOURNEYS = new Map([
  ["owner UAT technical journey exposes the P0 lifecycle in en", { locale: "en", direction: "ltr", passed: true }],
  ["owner UAT technical journey exposes the P0 lifecycle in ar", { locale: "ar", direction: "rtl", passed: true }],
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function evidenceSha256(evidence) {
  return createHash("sha256").update(canonicalJson(evidence)).digest("hex");
}

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
  const maximumReportBytes = 10 * 1024 * 1024;
  if (reportBytes.length > maximumReportBytes) throw new Error("Playwright report exceeds the 10 MiB evidence limit");
  if (!/^[a-f0-9]{40}$/.test(gitCommit ?? "")) throw new Error("gitCommit must be a full lowercase SHA-1");
  const generated = new Date(generatedAtUtc);
  if (!Number.isFinite(generated.valueOf()) || generated.toISOString() !== generatedAtUtc) throw new Error("generatedAtUtc must be canonical UTC ISO-8601");
  const target = new URL(targetUrl);
  if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash)
    throw new Error("owner UAT target must be a credential-free HTTPS origin");
  let reportText;
  try { reportText = new TextDecoder("utf-8", { fatal: true }).decode(reportBytes); }
  catch { throw new Error("Playwright report must use valid UTF-8 encoding"); }
  let report;
  try { report = JSON.parse(reportText); } catch { throw new Error("Playwright report must be valid JSON"); }
  if (!Array.isArray(report?.errors) || report.errors.length !== 0)
    throw new Error("owner UAT report contains report-level errors");
  const stats = report?.stats;
  if (stats?.expected !== JOURNEYS.size || stats?.unexpected !== 0 || stats?.flaky !== 0 || stats?.skipped !== 0)
    throw new Error("owner UAT report aggregate outcomes are not exactly two expected passes");
  if (report?.config?.forbidOnly !== true)
    throw new Error("owner UAT report must forbid focused tests with Playwright forbidOnly");
  if (report?.config?.fullyParallel !== false)
    throw new Error("owner UAT report must disable Playwright fullyParallel suite execution");
  if (report?.config?.workers !== 1)
    throw new Error("owner UAT report must use exactly one Playwright worker");
  const filteredProjects = report?.config?.filteredProjects;
  if (!Array.isArray(filteredProjects) || filteredProjects.length !== 1 || filteredProjects[0]?.name !== "chromium")
    throw new Error("owner UAT report must contain exactly the approved Chromium project");
  if (filteredProjects[0]?.retries !== 0)
    throw new Error("owner UAT report must keep Playwright retries disabled");
  if (filteredProjects[0]?.repeatEach !== 1)
    throw new Error("owner UAT report must execute each bilingual journey exactly once with Playwright repeatEach");
  let reportTarget;
  try { reportTarget = new URL(filteredProjects[0]?.use?.baseURL); } catch { throw new Error("owner UAT report target must be a valid URL"); }
  if (reportTarget.protocol !== "https:" || reportTarget.username || reportTarget.password || reportTarget.pathname !== "/" || reportTarget.search || reportTarget.hash)
    throw new Error("owner UAT report target must be a credential-free HTTPS origin");
  if (reportTarget.origin !== target.origin) throw new Error("owner UAT report target origin does not match the certified target origin");
  const reportStarted = new Date(report?.stats?.startTime);
  const reportDuration = report?.stats?.duration;
  if (!Number.isFinite(reportStarted.valueOf()) || reportStarted.toISOString() !== report?.stats?.startTime ||
      !Number.isFinite(reportDuration) || reportDuration <= 0)
    throw new Error("owner UAT report timing must include a positive duration");
  if (!Number.isSafeInteger(reportDuration))
    throw new Error("owner UAT report duration must use integer milliseconds");
  const maximumReportDurationMs = 30 * 60 * 1000;
  if (reportDuration > maximumReportDurationMs)
    throw new Error("owner UAT report duration must not exceed 30 minutes");
  const reportCompleted = new Date(reportStarted.valueOf() + reportDuration);
  if (reportCompleted > generated) throw new Error("owner UAT report cannot be future-dated");
  if (generated.valueOf() - reportCompleted.valueOf() > 15 * 60 * 1000)
    throw new Error("owner UAT report must be fresh when evidence is generated");
  const approvedSuites = report.suites;
  if (!Array.isArray(approvedSuites) || approvedSuites.length !== 1 ||
      approvedSuites[0]?.title !== "owner-uat.spec.ts" || approvedSuites[0]?.file !== "owner-uat.spec.ts" ||
      (approvedSuites[0]?.suites !== undefined &&
        (!Array.isArray(approvedSuites[0].suites) || approvedSuites[0].suites.length !== 0)))
    throw new Error("owner UAT report must contain exactly the approved owner UAT suite");
  const specs = allSpecs(approvedSuites);
  if (specs.length !== JOURNEYS.size) throw new Error("owner UAT report must contain exactly the approved bilingual journeys");
  const approvedJourneyTitles = [...JOURNEYS.keys()];
  if (specs.some((spec, index) => spec?.title !== approvedJourneyTitles[index]))
    throw new Error("owner UAT report must preserve the approved bilingual journey order");
  const seen = new Set();
  const journeys = [];
  let previousJourneyCompleted = reportStarted;
  for (const spec of specs) {
    if (spec?.file !== "owner-uat.spec.ts")
      throw new Error(`owner UAT journey is not attributed to the approved owner UAT spec file: ${spec?.title ?? "<missing>"}`);
    if (!JOURNEYS.has(spec?.title) || seen.has(spec.title)) throw new Error("owner UAT report contains a missing, duplicate, or unexpected journey");
    seen.add(spec.title);
    if (spec.ok !== true || !Array.isArray(spec.tests) || spec.tests.length !== 1) throw new Error(`owner UAT journey did not pass: ${spec.title}`);
    const [test] = spec.tests;
    if (test.projectName !== "chromium")
      throw new Error(`owner UAT journey did not run in the approved Chromium project: ${spec.title}`);
    if (test.status !== "expected")
      throw new Error(`owner UAT journey has a contradictory test-level outcome: ${spec.title}`);
    if (test.annotations !== undefined && (!Array.isArray(test.annotations) || test.annotations.length !== 0))
      throw new Error(`owner UAT journey must not carry Playwright annotations: ${spec.title}`);
    if (test.expectedStatus !== "passed" || !Array.isArray(test.results) || test.results.length !== 1 || test.results[0]?.status !== "passed")
      throw new Error(`owner UAT journey did not pass: ${spec.title}`);
    const result = test.results[0];
    if (!Array.isArray(result?.annotations) || result.annotations.length !== 0)
      throw new Error(`owner UAT journey result must not carry Playwright annotations: ${spec.title}`);
    if (result?.attachments !== undefined && (!Array.isArray(result.attachments) || result.attachments.length !== 0))
      throw new Error(`owner UAT journey must not retain attached artifacts: ${spec.title}`);
    if ((result?.stdout !== undefined && (!Array.isArray(result.stdout) || result.stdout.length !== 0)) ||
        (result?.stderr !== undefined && (!Array.isArray(result.stderr) || result.stderr.length !== 0)))
      throw new Error(`owner UAT journey must not retain stdout or stderr console output: ${spec.title}`);
    if (result?.retry !== 0)
      throw new Error(`owner UAT journey must pass on a clean first attempt with retry provenance: ${spec.title}`);
    if ((result?.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length !== 0)) || result?.error != null)
      throw new Error(`owner UAT journey contains test-level errors: ${spec.title}`);
    const resultDuration = result?.duration;
    if (!Number.isFinite(resultDuration) || resultDuration <= 0 || resultDuration > reportDuration)
      throw new Error(`owner UAT journey duration is invalid: ${spec.title}`);
    if (!Number.isSafeInteger(resultDuration))
      throw new Error(`owner UAT journey duration must use integer milliseconds: ${spec.title}`);
    const resultStarted = new Date(result?.startTime);
    const resultCompleted = new Date(resultStarted.valueOf() + resultDuration);
    if (!Number.isFinite(resultStarted.valueOf()) || resultStarted.toISOString() !== result?.startTime ||
        resultStarted < reportStarted || resultCompleted > reportCompleted)
      throw new Error(`owner UAT journey timing is outside the certified report window: ${spec.title}`);
    if (resultStarted < previousJourneyCompleted)
      throw new Error(`owner UAT journey chronology overlaps or reverses the approved order: ${spec.title}`);
    journeys.push({
      locale: JOURNEYS.get(spec.title).locale,
      startedAtUtc: resultStarted.toISOString(),
      completedAtUtc: resultCompleted.toISOString(),
    });
    previousJourneyCompleted = resultCompleted;
  }
  for (const title of JOURNEYS.keys()) if (!seen.has(title)) throw new Error(`owner UAT journey is missing: ${title}`);
  const evidence = {
    schemaVersion: 1,
    gate: "owner-uat-technical-journey",
    generatedAtUtc,
    reportStartedAtUtc: reportStarted.toISOString(),
    reportCompletedAtUtc: reportCompleted.toISOString(),
    gitCommit,
    targetOrigin: target.origin,
    reportSha256: createHash("sha256").update(reportBytes).digest("hex"),
    locales: [...JOURNEYS.values()],
    journeys,
    passed: true,
    ownerApprovalRecorded: false,
  };
  return { ...evidence, evidenceSha256: evidenceSha256(evidence) };
}

export async function writeOwnerUatEvidence(path, evidence) {
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

export function parseOwnerUatEvidenceArgs(args) {
  const allowed = new Map([
    ["--report", "reportPath"],
    ["--output", "outputPath"],
    ["--git-commit", "gitCommit"],
  ]);
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const key = allowed.get(flag);
    if (!key) throw new Error(`unknown owner UAT evidence argument: ${flag ?? "<missing>"}`);
    if (key in parsed) throw new Error(`duplicate owner UAT evidence argument: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`owner UAT evidence argument requires a value: ${flag}`);
    parsed[key] = value;
  }
  return parsed;
}

async function main(args) {
  const { reportPath, outputPath, gitCommit } = parseOwnerUatEvidenceArgs(args);
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
