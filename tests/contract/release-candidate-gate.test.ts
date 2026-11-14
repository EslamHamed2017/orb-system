import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, generateKeyPairSync, sign } from "node:crypto";

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

test("owner UAT candidate verifier binds the signed manifest to the approved commit", () => {
  const dir = mkdtempSync(join(tmpdir(), "orb-uat-candidate-"));
  try {
    const approvedCommit = "a".repeat(40);
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicPem = publicKey.export({ type: "spki", format: "pem" });
    const publicDer = publicKey.export({ type: "spki", format: "der" });
    const hex = "b".repeat(64);
    const signedPayload = {
      buildManifestSha256: hex,
      candidate: "internal-alpha-rc",
      containerSha256: hex,
      contractGuard: "openapi-contract, traceability, deferred-surface",
      deploymentPerformed: false,
      frozenAtUtc: "2026-11-13T22:30:00Z",
      gitCommit: approvedCommit,
      healthEvidenceSha256: hex,
      healthEvidenceFile: "health.json",
      lockSha256: hex,
      openapiOperationCount: 109,
      openapiSha256: hex,
      ownerApprovalRecorded: false,
      sbomFile: "sbom.json",
      sbomSha256: hex,
      sourceSha256: hex,
      containerImage: `orb@sha256:${hex}`,
    };
    const payloadBytes = Buffer.from(JSON.stringify(signedPayload, Object.keys(signedPayload).sort()));
    const manifest = {
      schemaVersion: 1,
      signature: {
        algorithm: "RSA-SHA256",
        publicKeySha256: createHash("sha256").update(publicDer).digest("hex"),
        valueBase64: sign("RSA-SHA256", payloadBytes, privateKey).toString("base64"),
      },
      signedPayload,
    };
    const manifestPath = join(dir, "manifest.json");
    const publicKeyPath = join(dir, "public.pem");
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    writeFileSync(publicKeyPath, publicPem);

    const verify = (commit: string) => spawnSync(
      "ops/acceptance/verify-owner-uat-candidate.sh",
      [manifestPath, publicKeyPath, commit],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(verify(approvedCommit).status, 0);
    assert.notEqual(verify("c".repeat(40)).status, 0, "a different approved commit must fail");

    manifest.signedPayload.gitCommit = "d".repeat(40);
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    assert.notEqual(verify(approvedCommit).status, 0, "tampered signed payload must fail");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("owner UAT candidate verifier rejects a manifest replaced after signature verification", () => {
  const dir = mkdtempSync(join(tmpdir(), "orb-uat-candidate-snapshot-"));
  try {
    const approvedCommit = "a".repeat(40);
    const signedCommit = "c".repeat(40);
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicPem = publicKey.export({ type: "spki", format: "pem" });
    const publicDer = publicKey.export({ type: "spki", format: "der" });
    const hex = "b".repeat(64);
    const signedPayload = {
      buildManifestSha256: hex,
      candidate: "internal-alpha-rc",
      containerSha256: hex,
      contractGuard: "openapi-contract, traceability, deferred-surface",
      deploymentPerformed: false,
      frozenAtUtc: "2026-11-13T22:30:00Z",
      gitCommit: signedCommit,
      healthEvidenceSha256: hex,
      healthEvidenceFile: "health.json",
      lockSha256: hex,
      openapiOperationCount: 109,
      openapiSha256: hex,
      ownerApprovalRecorded: false,
      sbomFile: "sbom.json",
      sbomSha256: hex,
      sourceSha256: hex,
      containerImage: `orb@sha256:${hex}`,
    };
    const payloadBytes = Buffer.from(JSON.stringify(signedPayload, Object.keys(signedPayload).sort()));
    const manifest = {
      schemaVersion: 1,
      signature: {
        algorithm: "RSA-SHA256",
        publicKeySha256: createHash("sha256").update(publicDer).digest("hex"),
        valueBase64: sign("RSA-SHA256", payloadBytes, privateKey).toString("base64"),
      },
      signedPayload,
    };
    const manifestPath = join(dir, "manifest.json");
    const replacementPath = join(dir, "replacement.json");
    const publicKeyPath = join(dir, "public.pem");
    const wrapperPath = join(dir, "openssl");
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    writeFileSync(replacementPath, `${JSON.stringify({
      ...manifest,
      signedPayload: { ...signedPayload, gitCommit: approvedCommit },
    })}\n`);
    writeFileSync(publicKeyPath, publicPem);
    writeFileSync(wrapperPath, `#!/bin/sh\nset -eu\n"$REAL_OPENSSL" "$@"\nstatus=$?\nif [ "$status" -eq 0 ] && [ "\${1:-}" = dgst ] && [ -f "$SWAP_MANIFEST" ]; then\n  mv -- "$SWAP_MANIFEST" "$TARGET_MANIFEST"\nfi\nexit "$status"\n`);
    chmodSync(wrapperPath, 0o755);

    const result = spawnSync(
      "ops/acceptance/verify-owner-uat-candidate.sh",
      [manifestPath, publicKeyPath, approvedCommit],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          REAL_OPENSSL: execFileSync("sh", ["-c", "command -v openssl"], { encoding: "utf8" }).trim(),
          SWAP_MANIFEST: replacementPath,
          TARGET_MANIFEST: manifestPath,
        },
      },
    );
    assert.notEqual(result.status, 0, "an unsigned replacement must not inherit verification from an earlier manifest snapshot");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test("owner UAT candidate verifier rejects a public key replaced after initial validation", () => {
  const dir = mkdtempSync(join(tmpdir(), "orb-uat-candidate-key-snapshot-"));
  try {
    const approvedCommit = "a".repeat(40);
    const trusted = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const attackerPublicPem = attacker.publicKey.export({ type: "spki", format: "pem" });
    const attackerPublicDer = attacker.publicKey.export({ type: "spki", format: "der" });
    const hex = "b".repeat(64);
    const signedPayload = {
      buildManifestSha256: hex,
      candidate: "internal-alpha-rc",
      containerSha256: hex,
      contractGuard: "openapi-contract, traceability, deferred-surface",
      deploymentPerformed: false,
      frozenAtUtc: "2026-11-13T22:30:00Z",
      gitCommit: approvedCommit,
      healthEvidenceSha256: hex,
      healthEvidenceFile: "health.json",
      lockSha256: hex,
      openapiOperationCount: 109,
      openapiSha256: hex,
      ownerApprovalRecorded: false,
      sbomFile: "sbom.json",
      sbomSha256: hex,
      sourceSha256: hex,
      containerImage: `orb@sha256:${hex}`,
    };
    const payloadBytes = Buffer.from(JSON.stringify(signedPayload, Object.keys(signedPayload).sort()));
    const manifest = {
      schemaVersion: 1,
      signature: {
        algorithm: "RSA-SHA256",
        publicKeySha256: createHash("sha256").update(attackerPublicDer).digest("hex"),
        valueBase64: sign("RSA-SHA256", payloadBytes, attacker.privateKey).toString("base64"),
      },
      signedPayload,
    };
    const manifestPath = join(dir, "manifest.json");
    const publicKeyPath = join(dir, "public.pem");
    const replacementKeyPath = join(dir, "replacement.pem");
    const wrapperPath = join(dir, "openssl");
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    writeFileSync(publicKeyPath, trusted.publicKey.export({ type: "spki", format: "pem" }));
    writeFileSync(replacementKeyPath, attackerPublicPem);
    writeFileSync(wrapperPath, `#!/bin/sh\nset -eu\nif [ "\${1:-}" = dgst ] && [ -f "$SWAP_PUBLIC_KEY" ]; then\n  mv -- "$SWAP_PUBLIC_KEY" "$TARGET_PUBLIC_KEY"\nfi\nexec "$REAL_OPENSSL" "$@"\n`);
    chmodSync(wrapperPath, 0o755);

    const result = spawnSync(
      "ops/acceptance/verify-owner-uat-candidate.sh",
      [manifestPath, publicKeyPath, approvedCommit],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          REAL_OPENSSL: execFileSync("sh", ["-c", "command -v openssl"], { encoding: "utf8" }).trim(),
          SWAP_PUBLIC_KEY: replacementKeyPath,
          TARGET_PUBLIC_KEY: publicKeyPath,
        },
      },
    );
    assert.equal(existsSync(replacementKeyPath), false, "the wrapper must perform the simulated key replacement");
    assert.notEqual(
      result.status,
      0,
      "a replacement public key must not inherit trust from the originally approved key path",
    );
    assert.match(result.stderr, /manifest signature verification failed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
