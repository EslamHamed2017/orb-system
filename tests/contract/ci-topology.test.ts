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
    { models: 40, enums: 34, tables: 27, rows: 46 });
  assert.match(baseline.seed.digest, /^[a-f0-9]{64}$/);
});
