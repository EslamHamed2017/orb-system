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

test("deployed owner UAT is explicitly authorized and limited to the bilingual pilot journey", () => {
  const deployed = workflow.match(/^  deployed-acceptance:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(workflow, /owner_uat_authorized:[\s\S]*?type: boolean/);
  assert.match(deployed, /inputs\.owner_uat_authorized == true/);
  assert.match(deployed, /run-owner-uat-gate\.sh/);
  assert.doesNotMatch(deployed, /playwright test --project=chromium/);

  const gate = readFileSync(resolve(ROOT, "ops/acceptance/run-owner-uat-gate.sh"), "utf8");
  assert.match(gate, /ORB_OWNER_UAT_AUTHORIZATION/);
  assert.match(gate, /readonly release_commit=.*git rev-parse HEAD/);
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
  assert.match(gate, /ORB_OWNER_UAT_EVIDENCE_DIR/);
  assert.match(gate, /PLAYWRIGHT_JSON_OUTPUT_FILE/);
  assert.match(gate, /--reporter=html,json/);
  assert.match(gate, /owner-uat-evidence\.mjs[\s\S]*--report[\s\S]*--output/);
  assert.match(deployed, /ORB_OWNER_UAT_EVIDENCE_DIR:.*runner\.temp/);
  assert.match(deployed, /name: owner-uat-evidence/);
  assert.match(deployed, /if: success\(\)[\s\S]*path:.*owner-uat-evidence/);
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
    { models: 55, enums: 39, tables: 27, rows: 46 });
  assert.match(baseline.seed.digest, /^[a-f0-9]{64}$/);
});
