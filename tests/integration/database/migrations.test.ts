import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");
const MIGRATIONS = resolve(ROOT, "prisma/migrations");
const INITIAL = resolve(MIGRATIONS, "202611050001_r1_initial/migration.sql");
const EXPAND = resolve(MIGRATIONS, "202611110001_concept_realignment_expand/migration.sql");
const CUTOVER = resolve(ROOT, "docs/runbooks/concept-realignment-cutover.md");
const LOCK = resolve(MIGRATIONS, "migration_lock.toml");
const PRISMA_CLI = resolve(ROOT, "node_modules/prisma/build/index.js");
const missing = [SCHEMA, INITIAL, EXPAND, CUTOVER, LOCK].filter((path) => !existsSync(path));
const redReason = missing.length
  ? `ORB-R1-0202 migration artifacts are missing: ${missing.map((path) => path.slice(ROOT.length + 1)).join(", ")}`
  : undefined;

test("RED prerequisite: the complete ORB-R1-0202 migration artifact set exists", () => {
  assert.deepEqual(missing, [], redReason);
});

test("initial migration is PostgreSQL, substantive, declarative, and non-destructive", { skip: redReason }, () => {
  assert.match(readFileSync(LOCK, "utf8"), /^provider\s*=\s*["']postgresql["']/m);
  const sql = readFileSync(INITIAL, "utf8");
  assert.ok(sql.length > 10_000, "complete R1 migration cannot be a placeholder");
  assert.match(sql, /\bcreate\s+table\b/i);
  assert.match(sql, /\bcreate\s+type\b[^;]+\bas\s+enum\b/i);
  assert.match(sql, /\bforeign\s+key\b/i);
  assert.match(sql, /\b(?:check|unique)\s*\(/i);
  assert.doesNotMatch(sql, /\b(?:todo|fixme|placeholder|not\s+implemented)\b/i);
  assert.doesNotMatch(sql, /\b(?:drop\s+schema|drop\s+database)\b/i);
});

test("Prisma validates before database infrastructure is involved", { skip: redReason }, () => {
  assert.ok(existsSync(PRISMA_CLI), "installed Prisma CLI is required to validate ORB-R1-0202");
  const result = spawnSync(process.execPath, [PRISMA_CLI, "validate", "--schema", SCHEMA], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://orb_test:orb_test@127.0.0.1:5432/orb_test" },
  });
  assert.equal(result.status, 0, `prisma validate failed\n${result.stdout}${result.stderr}`);
});

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
test("fresh isolated PostgreSQL applies the complete migration", {
  skip: redReason || (!databaseUrl ? "ORB_TEST_DATABASE_URL not supplied; structural migration tests still run" : false),
}, () => {
  assert.match(databaseUrl!, /^postgres(?:ql)?:\/\//, "ORB_TEST_DATABASE_URL must be PostgreSQL");
  assert.ok(existsSync(PRISMA_CLI), "installed Prisma CLI is required to apply ORB-R1-0202");
  const result = spawnSync(process.execPath, [PRISMA_CLI, "migrate", "deploy", "--schema", SCHEMA], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: databaseUrl! }, timeout: 120_000,
  });
  assert.equal(result.status, 0, `fresh migrate deploy failed\n${result.stdout}${result.stderr}`);
});

test("concept realignment migration is expand-only and keeps legacy application columns", { skip: redReason }, () => {
  const sql = readFileSync(EXPAND, "utf8");
  assert.match(sql, /CREATE TABLE "ContractLine"/);
  assert.match(sql, /CREATE TABLE "SalesShipmentDatasetLine"/);
  assert.match(sql, /CREATE TABLE "Permission"/);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(sql, /ALTER\s+COLUMN[^;]+SET\s+NOT\s+NULL/i);

  const initial = readFileSync(INITIAL, "utf8");
  for (const legacy of [
    '"ContractVersion"', '"coffee_specification_id"', '"SalesShipmentDataset"',
    '"SupplierShipmentDataset"', '"purchase_contract_id"', '"subject_type"',
  ]) assert.match(initial + sql, new RegExp(legacy));
});

test("cutover runbook defines safe flag stages and application-only rollback", { skip: redReason }, () => {
  const runbook = readFileSync(CUTOVER, "utf8");
  for (const required of [
    "ORB_REALIGNMENT_DUAL_WRITE=0", "ORB_REALIGNMENT_DUAL_WRITE=1",
    "ORB_REALIGNMENT_READ_PATH=legacy", "ORB_REALIGNMENT_READ_PATH=compare",
    "ORB_REALIGNMENT_READ_PATH=v2", "no database down-migration",
  ]) assert.match(runbook, new RegExp(required));
});

test("migration history contains the initial and concept-realignment expand migrations", { skip: redReason }, () => {
  const directories = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(directories, ["202611050001_r1_initial", "202611110001_concept_realignment_expand"]);
});
