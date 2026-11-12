import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const COMPOSE = resolve(ROOT, "compose.isolated-infrastructure.yml");
const GATE = resolve(ROOT, "ops/acceptance/run-isolated-infrastructure-gate.sh");
const WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");

test("isolated infrastructure defines distinct migration and restore data stores", () => {
  assert.ok(existsSync(COMPOSE), "isolated infrastructure compose file is required");
  const compose = readFileSync(COMPOSE, "utf8");
  for (const service of ["migration-postgres:", "restore-postgres:", "migration-object-store:", "restore-object-store:"])
    assert.match(compose, new RegExp(`^  ${service}`, "m"), `missing isolated service: ${service}`);
  for (const volume of ["migration-postgres-data:", "restore-postgres-data:", "migration-object-data:", "restore-object-data:"])
    assert.match(compose, new RegExp(`^  ${volume}`, "m"), `missing isolated volume: ${volume}`);
  assert.match(compose, /127\.0\.0\.1:/, "test services must bind only to loopback");
  assert.doesNotMatch(compose, /internal:\s*true/, "an internal Docker network silently disables required loopback publishing");
});

test("gate makes the real database migration and object restore checks mandatory", () => {
  assert.ok(existsSync(GATE), "isolated infrastructure gate script is required");
  const gate = readFileSync(GATE, "utf8");
  assert.match(gate, /docker run --rm --interactive/, "object client must preserve stdin for non-empty mc pipe uploads");
  assert.match(gate, /ORB_TEST_DATABASE_URL=/);
  assert.match(gate, /tests\/integration\/database\/migrations\.test\.ts/);
  assert.match(gate, /tests\/integration\/concurrency\/transaction-reference-postgres\.test\.ts/,
    "real PostgreSQL serial contention must be a mandatory isolated-infrastructure gate");
  assert.match(gate, /migration-object-store/);
  assert.match(gate, /restore-object-store/);
  assert.match(gate, /sha256sum/);
  assert.match(gate, /down[^\n]*--volumes/, "the gate must remove isolated state after execution");
});

test("CI requires the isolated infrastructure gate before browser acceptance", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  assert.match(workflow, /^  isolated-infrastructure:/m);
  const job = workflow.match(/^  isolated-infrastructure:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n)/m)?.[1] ?? "";
  assert.match(job, /run-isolated-infrastructure-gate\.sh/);
  assert.match(workflow, /needs: \[offline, isolated-infrastructure\]/);
});
