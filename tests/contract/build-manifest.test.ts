import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRIPT = join(ROOT, "scripts/verify-build-manifest.mjs");
const WORKFLOW = join(ROOT, ".github/workflows/ci.yml");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "orb-manifest-"));
  for (const directory of ["src", "specs/001-orb-trade-operations/contracts", ".next/server"])
    mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root, "src/index.ts"), "export const orb = 1;\n");
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: 9.0\n");
  writeFileSync(join(root, "specs/001-orb-trade-operations/contracts/openapi.yaml"), "openapi: 3.1.0\n");
  writeFileSync(join(root, ".next/server/app.js"), "bundle\n");
  return root;
}

test("creates a deterministic manifest binding source, lock, OpenAPI and build bytes", async () => {
  const { createManifest } = await import(pathToFileURL(SCRIPT).href);
  const root = fixture();
  const options = { root, gitCommit: "0123456789abcdef0123456789abcdef01234567" };
  const one = await createManifest(options);
  const two = await createManifest(options);
  assert.deepEqual(one, two);
  for (const field of ["sourceDigest", "lockfileDigest", "openApiDigest", "buildDigest", "artifactDigest"])
    assert.match(one[field], /^[a-f0-9]{64}$/);
});

test("changes to bound bytes are detected by verification", async () => {
  const { createManifest, writeManifest, verifyManifest } = await import(pathToFileURL(SCRIPT).href);
  const root = fixture();
  const manifestPath = join(root, "manifest.json");
  const options = { root, gitCommit: "0123456789abcdef0123456789abcdef01234567" };
  await writeManifest(manifestPath, await createManifest(options));
  await verifyManifest(manifestPath, options);
  writeFileSync(join(root, "src/index.ts"), "export const orb = 2;\n");
  await assert.rejects(verifyManifest(manifestPath, options), /does not match/);
});

test("production dependency audit fails closed on High or Critical findings", async () => {
  const { assertProductionAudit } = await import(pathToFileURL(SCRIPT).href);
  const clean = {
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
      dependencies: 292,
      totalDependencies: 426,
    },
  };
  assert.doesNotThrow(() => assertProductionAudit(clean));
  assert.throws(
    () => assertProductionAudit({ ...clean, metadata: { ...clean.metadata, vulnerabilities: { ...clean.metadata.vulnerabilities, high: 1 } } }),
    /High production dependency findings: 1/,
  );
  assert.throws(
    () => assertProductionAudit({ ...clean, metadata: { ...clean.metadata, vulnerabilities: { ...clean.metadata.vulnerabilities, critical: 1 } } }),
    /Critical production dependency findings: 1/,
  );
  assert.throws(() => assertProductionAudit({ metadata: { vulnerabilities: clean.metadata.vulnerabilities } }), /dependency count/);
  assert.throws(() => assertProductionAudit({ error: "registry unavailable" }), /valid vulnerability counts/);
});

test("CI workflow contains every quality and immutable-build gate", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  for (const required of [
    "pnpm install --frozen-lockfile",
    "pnpm run prisma:generate",
    "pnpm run typecheck",
    "tests/contract/**/*.test.ts",
    "tests/integration/**/*.test.ts",
    "pnpm exec playwright test",
    "pnpm audit --prod --json",
    "--assert-audit",
    "pnpm run build",
    "--write",
    "--verify",
    "git diff --exit-code",
  ]) assert.ok(workflow.includes(required), `missing CI gate: ${required}`);
});
