import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = resolve(ROOT, "docs/baselines/r1-schema-seed.json");

export async function collectBaseline() {
  const schema = await readFile(resolve(ROOT, "prisma/schema.prisma"), "utf8");
  const seed = await import(resolve(ROOT, "prisma/seed.ts"));
  const rowCounts = Object.fromEntries(Object.entries(seed.R1_SEED_MANIFEST.tables).map(([name, rows]) => [name, rows.length]));
  return {
    version: 1,
    schema: {
      models: [...schema.matchAll(/^model\s+(\w+)/gm)].length,
      enums: [...schema.matchAll(/^enum\s+(\w+)/gm)].length,
    },
    seed: {
      tables: Object.keys(rowCounts).length,
      rows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
      digest: seed.R1_SEED_DIGEST,
      rowCounts,
    },
  };
}

export async function verifyBaseline() {
  const expected = JSON.parse(await readFile(BASELINE, "utf8"));
  const actual = await collectBaseline();
  assert.deepEqual(actual, expected, "schema/seed baseline drifted; review changes and rewrite the baseline intentionally");
  return actual;
}

const action = process.argv[2];
if (action === "--write") {
  await writeFile(BASELINE, `${JSON.stringify(await collectBaseline(), null, 2)}\n`);
  console.log(`wrote ${BASELINE}`);
} else if (action === "--verify") {
  const baseline = await verifyBaseline();
  console.log(`schema/seed baseline verified: ${baseline.schema.models} models, ${baseline.schema.enums} enums, ${baseline.seed.tables} seeded tables, ${baseline.seed.rows} rows`);
} else {
  throw new Error("usage: verify-schema-seed-baseline.mjs --verify|--write");
}
