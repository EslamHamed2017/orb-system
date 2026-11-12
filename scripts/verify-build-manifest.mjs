#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OPENAPI = "specs/001-orb-trade-operations/contracts/openapi.yaml";
const SOURCE_ROOTS = [".github", "scripts", "src", "tests"];
const SOURCE_FILES = ["next.config.ts", "package.json", "playwright.config.ts", "tsconfig.json", "vitest.config.ts"];
const SHA256 = /^[a-f0-9]{64}$/;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function existingFiles(root, entries) {
  const files = [];
  async function visit(path) {
    let stat;
    try { stat = await lstat(path); } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in build manifests: ${path}`);
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(resolve(path, name));
    } else if (stat.isFile()) files.push(path);
  }
  for (const entry of entries) await visit(resolve(root, entry));
  return files;
}

async function treeDigest(root, entries, label) {
  const files = await existingFiles(root, entries);
  if (files.length === 0) throw new Error(`${label} has no files to hash`);
  const hash = createHash("sha256");
  for (const path of files.sort()) {
    const name = relative(root, path).split(sep).join("/");
    hash.update(name).update("\0").update(await readFile(path)).update("\0");
  }
  return hash.digest("hex");
}

async function fileDigest(root, path, label) {
  try { return digest(await readFile(resolve(root, path))); }
  catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} is missing: ${path}`);
    throw error;
  }
}

function currentCommit(root) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

export async function createManifest({ root = process.cwd(), gitCommit } = {}) {
  root = resolve(root);
  const commit = gitCommit ?? currentCommit(root);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("gitCommit must be a full 40-character lowercase SHA-1");
  const payload = {
    schemaVersion: 1,
    gitCommit: commit,
    sourceDigest: await treeDigest(root, [...SOURCE_ROOTS, ...SOURCE_FILES], "source set"),
    lockfileDigest: await fileDigest(root, "pnpm-lock.yaml", "lockfile"),
    openApiDigest: await fileDigest(root, OPENAPI, "OpenAPI contract"),
    buildDigest: await treeDigest(root, [".next"], "Next.js build"),
  };
  return { ...payload, artifactDigest: digest(JSON.stringify(payload)) };
}

export async function writeManifest(path, manifest) {
  for (const field of ["sourceDigest", "lockfileDigest", "openApiDigest", "buildDigest", "artifactDigest"])
    if (!SHA256.test(manifest[field] ?? "")) throw new Error(`Invalid ${field}`);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
}

export async function verifyManifest(path, options = {}) {
  const recorded = JSON.parse(await readFile(path, "utf8"));
  const actual = await createManifest(options);
  if (JSON.stringify(recorded) !== JSON.stringify(actual)) throw new Error("Build manifest does not match current repository and build bytes");
  return actual;
}

export function assertProductionAudit(report) {
  const vulnerabilities = report?.metadata?.vulnerabilities;
  const counts = ["info", "low", "moderate", "high", "critical"];
  if (!vulnerabilities || counts.some((severity) => !Number.isInteger(vulnerabilities[severity]) || vulnerabilities[severity] < 0))
    throw new Error("Production audit report lacks valid vulnerability counts");
  const dependencyCount = report?.metadata?.dependencies;
  const totalDependencyCount = report?.metadata?.totalDependencies;
  if (!Number.isInteger(dependencyCount) || dependencyCount <= 0 || !Number.isInteger(totalDependencyCount) || totalDependencyCount < dependencyCount)
    throw new Error("Production audit report lacks a valid dependency count");
  if (vulnerabilities.critical !== 0)
    throw new Error(`Critical production dependency findings: ${vulnerabilities.critical}`);
  if (vulnerabilities.high !== 0)
    throw new Error(`High production dependency findings: ${vulnerabilities.high}`);
  return { dependencyCount, totalDependencyCount, vulnerabilities: { ...vulnerabilities } };
}

async function main(args) {
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
  if (args[0] === "--write" && args[1]) return writeManifest(args[1], await createManifest({ root }));
  if (args[0] === "--verify" && args[1]) return verifyManifest(args[1], { root });
  if (args[0] === "--assert-audit" && args[1]) return assertProductionAudit(JSON.parse(await readFile(args[1], "utf8")));
  throw new Error("Usage: verify-build-manifest.mjs --write FILE | --verify FILE | --assert-audit FILE [--root DIR]");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
