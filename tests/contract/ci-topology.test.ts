import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const workflow = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");

test("CI separates offline, local-browser, and manually dispatched deployed acceptance gates", () => {
  for (const job of ["offline:", "local-browser:", "deployed-acceptance:"])
    assert.match(workflow, new RegExp(`^  ${job}`, "m"), `missing ${job} CI job`);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /environment: owner-acceptance/);
  assert.match(workflow, /ORB_TEST_BASE_URL:.*inputs\.acceptance_base_url/);
  assert.match(workflow, /ORB_TEST_MANAGED_SERVER: ["']1["']/);
  const local = workflow.match(/^  local-browser:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  const deployed = workflow.match(/^  deployed-acceptance:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(local, /ORB_TEST_AUTH: ["']1["']/);
  assert.match(local, /ORB_APP_ORIGIN: http:\/\/127\.0\.0\.1:3000/);
  assert.doesNotMatch(deployed, /ORB_TEST_AUTH|ORB_APP_ORIGIN/);
});

test("job-level CI environments never reference the unavailable runner context", () => {
  const jobs = workflow.split(/^  (?=[A-Za-z_][A-Za-z0-9_-]*:\s*$)/m).slice(1);
  for (const job of jobs) {
    const jobName = job.match(/^([A-Za-z_][A-Za-z0-9_-]*):/)?.[1] ?? "unknown";
    const envMatch = job.match(/^    env:(?:[ \t]+([^\n]*)|\n([\s\S]*?)(?=^    \S))/m);
    const jobEnv = envMatch?.[1] ?? envMatch?.[2] ?? "";
    assert.doesNotMatch(jobEnv, /\$\{\{\s*runner\./, `${jobName} job-level env must not use runner context`);
  }
});

test("every Prisma client generation step has a non-secret build-only database URL", () => {
  const generationSteps = workflow.split("run: pnpm run prisma:generate");
  assert.equal(generationSteps.length - 1, 3, "expected all three CI Prisma generation steps");
  for (const beforeRun of generationSteps.slice(0, -1)) {
    const stepPrefix = beforeRun.slice(beforeRun.lastIndexOf("\n      - "));
    assert.match(stepPrefix, /env:\n          DATABASE_URL: postgresql:\/\/orb_build:orb_build@127\.0\.0\.1:5432\/orb_build\n/,
      "Prisma generation must use an isolated build-only database URL");
  }
});

test("local browser acceptance uses construction modes and delegates infrastructure/UAT specs to their owned jobs", () => {
  const local = workflow.match(/^  local-browser:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  const isolated = workflow.match(/^  isolated-infrastructure:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(local, /ORB_E02_MODE: dry-run/);
  assert.match(local, /ORB_E03_E14_MODE: self-test/);
  assert.ok(local.includes("pnpm exec playwright test --project=chromium '^(?!.*(?:owner-uat|internal-alpha-lifecycle)\\.spec\\.ts).*'"),
    "local acceptance must exclude only the separately owned deployed and infrastructure specs at file discovery");
  assert.match(isolated, /pnpm exec playwright install --with-deps chromium/);
  assert.match(isolated, /run-internal-alpha-lifecycle\.sh/);
  assert.ok(isolated.indexOf("playwright install --with-deps chromium") < isolated.indexOf("run-internal-alpha-lifecycle.sh"),
    "the isolated runner must install Chromium before executing its lifecycle");
});

test("deployed owner UAT is explicitly authorized and limited to the bilingual pilot journey", () => {
  const deployed = workflow.match(/^  deployed-acceptance:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(workflow, /owner_uat_authorized:[\s\S]*?type: boolean/);
  assert.match(workflow, /approved_release_commit:[\s\S]*?required: true[\s\S]*?type: string/);
  assert.match(workflow, /release_candidate_manifest_base64:[\s\S]*?required: true[\s\S]*?type: string/);
  assert.match(workflow, /release_public_key_base64:[\s\S]*?required: true[\s\S]*?type: string/);
  assert.match(deployed, /inputs\.owner_uat_authorized == true/);
  assert.match(deployed, /ORB_APPROVED_RELEASE_COMMIT:.*inputs\.approved_release_commit/);
  assert.match(deployed, /actions\/checkout@v4[\s\S]*?ref:.*inputs\.approved_release_commit/);
  assert.match(deployed, /Validate approved release commit input[\s\S]*?\^\[a-f0-9\]\{40\}\$/);
  assert.match(deployed, /Verify exact approved release checkout[\s\S]*?git rev-parse HEAD[\s\S]*?git status --porcelain=v1 --untracked-files=all/);
  assert.match(deployed, /Materialize approved signed release candidate[\s\S]*?base64 --decode[\s\S]*?ORB_RELEASE_CANDIDATE_MANIFEST[\s\S]*?ORB_RELEASE_PUBLIC_KEY_PATH/);
  const checkoutIndex = deployed.indexOf("uses: actions/checkout@v4");
  const identityIndex = deployed.indexOf("name: Verify exact approved release checkout");
  const installIndex = deployed.indexOf("pnpm install --frozen-lockfile");
  assert.ok(checkoutIndex >= 0 && identityIndex > checkoutIndex && installIndex > identityIndex,
    "approved checkout identity and cleanliness must be verified before dependency installation");
  assert.match(deployed, /run-owner-uat-gate\.sh/);
  assert.doesNotMatch(deployed, /playwright test --project=chromium/);

  const gate = readFileSync(resolve(ROOT, "ops/acceptance/run-owner-uat-gate.sh"), "utf8");
  assert.match(gate, /ORB_OWNER_UAT_AUTHORIZATION/);
  assert.match(gate, /readonly release_commit=.*git rev-parse HEAD/);
  assert.match(gate, /ORB_APPROVED_RELEASE_COMMIT/);
  assert.match(gate, /ORB_RELEASE_CANDIDATE_MANIFEST/);
  assert.match(gate, /ORB_RELEASE_PUBLIC_KEY_PATH/);
  assert.match(gate, /verify-owner-uat-candidate\.sh/);
  assert.match(gate, /approved release commit must be a full lowercase SHA-1/);
  assert.match(gate, /release_commit.*ORB_APPROVED_RELEASE_COMMIT|ORB_APPROVED_RELEASE_COMMIT.*release_commit/s);
  assert.match(gate, /assert_clean_checkout/);
  assert.match(gate, /git status --porcelain=v1 --untracked-files=all/);
  assert.equal((gate.match(/assert_clean_checkout/g) ?? []).length, 3, "clean-checkout guard must be defined and run before and after UAT");
  assert.match(gate, /export ORB_EXPECTED_RELEASE_COMMIT="\$release_commit"/);
  assert.match(gate, /git rev-parse HEAD.*release_commit/s);
  assert.match(gate, /owner-uat-evidence\.mjs[\s\S]*--git-commit "\$release_commit"/);
  const evidenceGenerator = readFileSync(resolve(ROOT, "scripts/owner-uat-evidence.mjs"), "utf8");
  assert.match(evidenceGenerator, /gitCommit !== process\.env\.ORB_EXPECTED_RELEASE_COMMIT/);
  assert.doesNotMatch(evidenceGenerator, /execFileSync|git.*rev-parse/s);
  assert.match(gate, /OWNER_APPROVED/);
  assert.match(gate, /validate_owner_uat_target\.py/);
  const targetValidator = readFileSync(resolve(ROOT, "ops/acceptance/validate_owner_uat_target.py"), "utf8");
  assert.match(targetValidator, /scheme != "https"/);
  assert.match(targetValidator, /is_global/);
  assert.match(targetValidator, /getaddrinfo/);
  assert.match(gate, /owner-uat\.spec\.ts/);
  assert.match(gate, /--project=chromium/);
  assert.match(gate, /playwright test[\s\S]*--workers=1/, "owner-UAT browser journeys must run in exactly one worker");
  assert.match(gate, /playwright test[\s\S]*--timeout=30000/, "owner-UAT browser journeys must use the canonical 30-second per-journey timeout");
  assert.match(gate, /playwright test[\s\S]*--retries=0/, "owner-UAT browser journeys must disable retries");
  assert.match(gate, /playwright test[\s\S]*--repeat-each=1/, "owner-UAT browser journeys must execute exactly once per locale");
  assert.match(gate, /ORB_OWNER_UAT_EVIDENCE_DIR/);
  assert.match(gate, /PLAYWRIGHT_JSON_OUTPUT_FILE/);
  assert.match(gate, /--reporter=json/);
  assert.doesNotMatch(gate, /--reporter=(?:html|[^\n]*,html)/);
  assert.match(gate, /owner-uat-evidence\.mjs[\s\S]*--report[\s\S]*--output/);
  assert.match(deployed, /ORB_OWNER_UAT_EVIDENCE_DIR:.*runner\.temp/);
  assert.match(deployed, /name: owner-uat-evidence/);
  assert.match(deployed, /if: success\(\)[\s\S]*path:.*owner-uat-evidence\/manifest\.json/);
  assert.doesNotMatch(deployed, /path:.*owner-uat-evidence\s*$/m, "raw owner-UAT report directory must not be uploaded");
  assert.match(gate, /cleanup_sensitive_artifacts[\s\S]*rm -f -- "\$report"[\s\S]*rm -rf -- "\$playwright_output"[\s\S]*trap cleanup_sensitive_artifacts EXIT/,
    "raw owner-UAT report and browser artifacts must be deleted on every success or failure exit");
  assert.match(gate, /playwright_output="\$ORB_OWNER_UAT_EVIDENCE_DIR\/playwright-output"/);
  assert.match(gate, /playwright test[\s\S]*--output="\$playwright_output"[\s\S]*--reporter=json/,
    "owner-UAT traces, videos, and screenshots must stay inside the disposable evidence directory");
  assert.doesNotMatch(deployed, /deployed-acceptance-playwright-report|path: playwright-report/);
  assert.doesNotMatch(gate, /ORB_TEST_AUTH|ORB_TEST_MANAGED_SERVER|\|\| true|test\.skip/);

  const journey = readFileSync(resolve(ROOT, "tests/acceptance/owner-uat.spec.ts"), "utf8");
  assert.match(journey, /ORB_EXPECTED_RELEASE_COMMIT/);
  assert.match(journey, /if \(!expectedReleaseCommit\) throw new Error/);
  assert.doesNotMatch(journey, /if \(expectedReleaseCommit\)/);
  assert.match(journey, /release.*gitCommit/s);
  assert.match(journey, /readinessUrl\.pathname.*expectedReadinessUrl\.pathname/s);
  assert.match(journey, /readinessUrl\.search.*expectedReadinessUrl\.search/s);
  assert.match(journey, /cache-control.*no-store/is);
  assert.match(journey, /content-type[\s\S]{0,200}toMatch\(\/\^application\\\/json/);
  assert.match(journey, /expectedTargetOrigin/);
  assert.match(journey, /await page\.goto\(path\)/);
  assert.match(journey, /navigation response.*status.*(?:200|299)/is);
  assert.match(journey, /response!\.headers\(\)\["cache-control"\].*no-store/is);
  assert.match(journey, /response!\.headers\(\)\["x-content-type-options"\].*nosniff/is);
  assert.match(journey, /response!\.headers\(\)\["x-frame-options"\].*DENY/is);
  assert.match(journey, /response!\.headers\(\)\["strict-transport-security"\].*max-age=31536000/is);
  assert.match(journey, /response!\.headers\(\)\["permissions-policy"\].*camera=\(\), microphone=\(\), geolocation=\(\)/is);
  assert.match(journey, /response!\.headers\(\)\["referrer-policy"\].*strict-origin-when-cross-origin/is);
  assert.match(journey, /response!\.headers\(\)\["cross-origin-opener-policy"\].*same-origin/is);
  assert.match(journey, /response!\.headers\(\)\["cross-origin-resource-policy"\].*same-origin/is);
  assert.match(journey, /response!\.headers\(\)\["x-dns-prefetch-control"\].*off/is);
  assert.match(journey, /response!\.headers\(\)\["content-security-policy"\].*upgrade-insecure-requests/is);
  assert.doesNotMatch(journey, /function gotoApprovedTarget[\s\S]*?await gotoApprovedTarget\(page, path\)/);
  assert.match(journey, /finalUrl\.origin.*expectedTargetOrigin/s);
  assert.match(journey, /finalUrl\.pathname.*requestedUrl\.pathname/s);
  assert.match(journey, /requestedUrl\.searchParams/s);
  assert.match(journey, /finalUrl\.hash.*requestedUrl\.hash/s);
  assert.match(journey, /locale: ["']en["'], direction: ["']ltr["']/);
  assert.match(journey, /locale: ["']ar["'], direction: ["']rtl["']/);
  assert.match(journey, /supplier-shipments/);
  assert.match(journey, /sales-shipments/);
  assert.match(journey, /accounts\/sales-invoices/);
  assert.match(journey, /accounts\/supplier-invoices/);
  assert.match(journey, /reports\/product-movement/);
});

test("production responses expose global browser security and privacy headers on every route", async () => {
  const config = (await import("../../next.config.ts")).default;
  const routes = await config.headers?.();
  const global = routes?.find((route) => route.source === "/:path*");
  const headers = Object.fromEntries(global?.headers.map(({ key, value }) => [key.toLowerCase(), value]) ?? []);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.equal(headers["cross-origin-resource-policy"], "same-origin");
  assert.equal(headers["x-dns-prefetch-control"], "off");
  assert.equal(
    headers["content-security-policy"],
    "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests",
  );
});

test("offline gate cannot accidentally launch browser or target a deployment", () => {
  const offline = workflow.match(/^  offline:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.ok(offline, "offline job body is missing");
  assert.doesNotMatch(offline, /playwright|ORB_TEST_BASE_URL|next start/i);
  assert.match(offline, /tests\/unit\/\*\*\/\*\.test\.ts/);
  assert.match(offline, /tests\/integration\/\*\*\/\*\.test\.ts/);
});

test("recorded Prisma schema and deterministic seed baseline verifies against source", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-schema-seed-baseline.mjs", "--verify"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const baseline = JSON.parse(readFileSync(resolve(ROOT, "docs/baselines/r1-schema-seed.json"), "utf8"));
  assert.deepEqual({ models: baseline.schema.models, enums: baseline.schema.enums, tables: baseline.seed.tables, rows: baseline.seed.rows },
    { models: 58, enums: 40, tables: 32, rows: 51 });
  assert.match(baseline.seed.digest, /^[a-f0-9]{64}$/);
});
