import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const GATE = resolve(ROOT, "ops/acceptance/run-application-rollback-gate.sh");
const WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");

test("application rollback gate is isolated, revision-pinned, and forward-schema only", () => {
  assert.ok(existsSync(GATE), "rollback rehearsal gate script is required");
  const gate = readFileSync(GATE, "utf8");
  assert.match(gate, /readonly PINNED_ROLLBACK_APP_REVISION=[a-f0-9]{40}/);
  assert.match(gate, /ORB_ROLLBACK_APP_REVISION=.*PINNED_ROLLBACK_APP_REVISION/);
  assert.match(gate, /rollback revision substitution is not permitted/);
  assert.match(gate, /git worktree add --detach/);
  assert.match(gate, /127\.0\.0\.1/);
  assert.match(gate, /database_url=.*\$\{db_password\}/);
  assert.doesNotMatch(gate, /database_url=.*:\*\*\*@/);
  assert.match(gate, /migrate deploy/);
  assert.match(gate, /api\/health\/ready/);
  assert.match(gate, /_prisma_migrations/);
  assert.match(gate, /migration_digest\(\)/);
  assert.match(gate, /before_digest=\$\(migration_digest\)/);
  assert.match(gate, /expected_migration_names/);
  assert.match(gate, /database_migration_names/);
  assert.match(gate, /\[\[ "\$database_migration_names" == "\$expected_migration_names" \]\]/);
  assert.match(gate, /after_digest=\$\(migration_digest\)/);
  assert.match(gate, /\[\[ "\$after_digest" == "\$before_digest" \]\]/);
  assert.match(gate, /schema_digest\(\)/);
  assert.match(gate, /pg_dump[^\n]*--schema-only/);
  assert.match(gate, /before_schema_digest=\$\(schema_digest\)/);
  assert.match(gate, /after_schema_digest=\$\(schema_digest\)/);
  assert.match(gate, /\[\[ "\$after_schema_digest" == "\$before_schema_digest" \]\]/);
  assert.doesNotMatch(gate, /migrate reset|DROP (?:DATABASE|SCHEMA|TABLE|COLUMN)/i);
});

test("rollback rehearsal verifies a legacy write after expansion and is mandatory in isolated CI", () => {
  const gate = readFileSync(GATE, "utf8");
  assert.match(gate, /ORB-ROLLBACK-SMOKE/);
  assert.match(gate, /legacy_app_write/);
  const workflow = readFileSync(WORKFLOW, "utf8");
  const job = workflow.match(/^  isolated-infrastructure:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(job, /run-application-rollback-gate\.sh/);
});


test("application rollback gate rejects rollback revision substitution before infrastructure startup", () => {
  const result = spawnSync("bash", [GATE], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ORB_ROLLBACK_APP_REVISION: "0000000000000000000000000000000000000000" },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /rollback revision substitution is not permitted/);
  assert.doesNotMatch(result.stderr, /docker|postgres/i);
});
