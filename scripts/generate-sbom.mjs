#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = process.argv[2];
if (!output) throw new Error("Usage: generate-sbom.mjs OUTPUT.json");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const inventory = JSON.parse(execFileSync("corepack", ["pnpm", "list", "--prod", "--json", "--depth", "Infinity"], { encoding: "utf8" }));
if (!Array.isArray(inventory) || inventory.length !== 1) throw new Error("Expected one pnpm production inventory root");
const components = new Map();
function visit(dependencies = {}) {
  for (const [name, detail] of Object.entries(dependencies)) {
    if (!detail || typeof detail.version !== "string" || detail.version.length === 0) throw new Error(`Missing version for ${name}`);
    const purl = `pkg:npm/${encodeURIComponent(name)}@${detail.version}`;
    components.set(purl, { type: "library", name, version: detail.version, purl });
    visit(detail.dependencies);
  }
}
visit(inventory[0].dependencies);
for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
  const normalized = String(version).replace(/^[~^]/, "");
  const purl = `pkg:npm/${encodeURIComponent(name)}@${normalized}`;
  if (!components.has(purl)) throw new Error(`Production dependency missing from pnpm inventory: ${name}@${normalized}`);
}
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: { component: { type: "application", name: pkg.name, version: pkg.version, purl: `pkg:npm/${pkg.name}@${pkg.version}` } },
  components: [...components.values()].sort((a, b) => a.purl.localeCompare(b.purl)),
};
const target = resolve(output);
writeFileSync(`${target}.tmp`, `${JSON.stringify(sbom, null, 2)}\n`, { mode: 0o644 });
renameSync(`${target}.tmp`, target);
console.log(`wrote CycloneDX SBOM with ${sbom.components.length} production components: ${target}`);
