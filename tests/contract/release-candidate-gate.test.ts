import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();

test("release candidate gate exposes immutable build, SBOM, health and signature commands", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["release:sbom"], "node scripts/generate-sbom.mjs");
  assert.equal(pkg.scripts["release:health"], "ops/release/check-candidate-health.sh");
  assert.equal(pkg.scripts["release:verify"], "ops/release/verify-candidate.sh");
  assert.equal(pkg.scripts["release:freeze"], "ops/release/freeze-candidate.sh --freeze");
});

test("SBOM generator emits a deterministic CycloneDX production inventory", () => {
  const dir = mkdtempSync(join(tmpdir(), "orb-sbom-"));
  try {
    const output = join(dir, "sbom.json");
    execFileSync(process.execPath, ["--strip-types", "scripts/generate-sbom.mjs", output], { cwd: root });
    const first = readFileSync(output, "utf8");
    execFileSync(process.execPath, ["--strip-types", "scripts/generate-sbom.mjs", output], { cwd: root });
    const second = readFileSync(output, "utf8");
   assert.equal(second, first);
    const sbom = JSON.parse(first);
    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.equal(sbom.specVersion, "1.6");
    assert.equal(sbom.metadata.component.name, "orb-system");
    assert.equal(sbom.metadata.component.version, "0.0.0");
    const directProduction = Object.entries(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies)
      .map(([name, version]) => `pkg:npm/${encodeURIComponent(name)}@${version}`).sort();
    const componentPurls = new Set(sbom.components.map((c: { purl: string }) => c.purl));
    for (const purl of directProduction) assert.equal(componentPurls.has(purl), true, `missing direct production dependency ${purl}`);
    assert.ok(componentPurls.size > directProduction.length, "transitive production dependencies must be inventoried");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("freezer is RC bound, derives contract counts and binds health evidence", () => {
  const script = readFileSync(join(root, "ops/release/freeze-candidate.sh"), "utf8");
  assert.match(script, /internal-alpha-rc/);
  assert.match(script, /ORB_HEALTH_EVIDENCE_FILE/);
  assert.match(script, /ORB_BUILD_MANIFEST_FILE/);
  assert.match(script, /verify-build-manifest\.mjs --verify/);
  assert.match(script, /openapi_operation_count=/);
  assert.doesNotMatch(script, /openapiOperationCount\"]:79/);
  assert.match(script, /deploymentPerformed/);
});

test("container generation uses a non-secret build-only database URL", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  const buildStage = dockerfile.slice(dockerfile.indexOf("FROM dependencies AS build"), dockerfile.indexOf("FROM base AS runtime"));
  const runtimeStage = dockerfile.slice(dockerfile.indexOf("FROM base AS runtime"));
  assert.match(buildStage, /ENV DATABASE_URL=postgresql:\/\/orb_build:orb_build@127\.0\.0\.1:5432\/orb_build/);
  assert.doesNotMatch(runtimeStage, /DATABASE_URL/);
  assert.match(runtimeStage, /ENV ORB_RELEASE_COMMIT=\$\{ORB_BUILD_DIGEST\}/);
});
