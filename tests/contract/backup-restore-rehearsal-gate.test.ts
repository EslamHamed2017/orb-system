import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("ops/acceptance/run-isolated-infrastructure-gate.sh", "utf8");
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

test("isolated infrastructure gate performs an encrypted backup and restore rehearsal", () => {
  for (const token of [
    "prisma/seed.ts",
    "pg_dump",
    "pg_restore",
    "openssl enc -aes-256-cbc -pbkdf2",
    "database.dump.enc",
    "objects.tar.enc",
    "manifest.sha256",
    "database-integrity.source",
    "database-integrity.restored",
    "object-integrity.source",
    "object-integrity.restored",
    "cmp",
  ]) assert.ok(script.includes(token), `missing backup/restore control: ${token}`);
  assert.doesNotMatch(script, /\|\| true|test\.skip|--pass-with-no-tests/);
});

test("restore rehearsal is a mandatory CI dependency before browser acceptance", () => {
  assert.match(workflow, /Real PostgreSQL migration, encrypted backup and isolated restore gate/);
  assert.match(workflow, /local-browser:[\s\S]*needs: \[offline, isolated-infrastructure\]/);
});
