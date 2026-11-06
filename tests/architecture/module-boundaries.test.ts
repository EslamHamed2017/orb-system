import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_ROOT = resolve(ROOT, "src");
const LAYERS = ["platform", "modules", "ui", "app"] as const;
type Layer = (typeof LAYERS)[number];

type SourceRecord = { path: string; imports: string[] };
type Violation = { path: string; detail: string };

const ALLOWED_DEPENDENCIES: Record<Layer, ReadonlySet<Layer>> = {
  platform: new Set(["platform"]),
  modules: new Set(["platform", "modules"]),
  ui: new Set(["platform", "modules", "ui"]),
  app: new Set(LAYERS),
};

const DEFERRED_IDENTIFIERS = [
  /bank(?:ingestion|integration|import|matching)/,
  /tax(?:engine|pack|evidencepack)/,
  /(?:legacy|historical)migration/,
  /sharedexpense(?:allocation)?/,
  /(?:configurable)?approvalrule|approvaldesigner/,
  /dynamicroute|routedesigner/,
  /(?:advanced|complex)claim/,
  /generalledger|chartofaccounts/,
];

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function layerOfPath(path: string): Layer | undefined {
  const normalizedPath = path.replaceAll("\\", "/");
  return LAYERS.find((layer) => normalizedPath === `src/${layer}` || normalizedPath.startsWith(`src/${layer}/`));
}

function layerOfImport(specifier: string, importer: string): Layer | undefined {
  if (specifier.startsWith("@/")) return layerOfPath(`src/${specifier.slice(2)}`);
  if (specifier.startsWith("src/")) return layerOfPath(specifier);
  if (!specifier.startsWith(".")) return undefined;
  const importerDirectory = dirname(importer).replaceAll("\\", "/");
  const resolved = resolve("/repo", importerDirectory, specifier).slice("/repo/".length);
  return layerOfPath(resolved);
}

function boundaryViolations(records: SourceRecord[]): Violation[] {
  const violations: Violation[] = [];
  for (const record of records) {
    const sourceLayer = layerOfPath(record.path);
    const identifiers = [record.path, ...record.imports];
    for (const identifier of identifiers) {
      const token = normalized(identifier);
      if (DEFERRED_IDENTIFIERS.some((pattern) => pattern.test(token))) {
        violations.push({ path: record.path, detail: `deferred identifier: ${identifier}` });
      }
    }
    if (!sourceLayer) continue;
    for (const specifier of record.imports) {
      const targetLayer = layerOfImport(specifier, record.path);
      if (targetLayer && !ALLOWED_DEPENDENCIES[sourceLayer].has(targetLayer)) {
        violations.push({ path: record.path, detail: `${sourceLayer} must not import ${targetLayer}: ${specifier}` });
      }
    }
  }
  return violations;
}

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".mts", ".cts"].includes(extname(entry.name)) ? [path] : [];
  });
}

function importsFrom(source: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) imports.add(match[1]);
  return [...imports];
}

function repositoryRecords(): SourceRecord[] {
  return sourceFiles(SOURCE_ROOT).map((path) => ({
    path: relative(ROOT, path).split(sep).join("/"),
    imports: importsFrom(readFileSync(path, "utf8")),
  }));
}

test("documented modular-monolith boundaries are present", () => {
  const expected = new Map([
    ["src/modules/README.md", ["access/masters", "projects/contracts", "shipments/routes", "evidence/documents/outbound", "supplier invoices/money/statements", "expenses/claims", "profit/closure", "audit/recovery"]],
    ["src/platform/README.md", ["must not import", "src/modules", "src/ui", "src/app"]],
    ["src/ui/README.md", ["must not import", "src/app"]],
  ]);
  for (const [path, phrases] of expected) {
    const absolute = resolve(ROOT, path);
    assert.ok(existsSync(absolute), `missing boundary document: ${path}`);
    const content = readFileSync(absolute, "utf8").toLowerCase();
    for (const phrase of phrases) assert.ok(content.includes(phrase), `${path} must document ${phrase}`);
  }
});

test("boundary analyzer rejects reverse imports", () => {
  const records: SourceRecord[] = [
    { path: "src/platform/database.ts", imports: ["@/modules/projects/service"] },
    { path: "src/modules/projects/service.ts", imports: ["../../ui/project-card"] },
    { path: "src/ui/project-card.tsx", imports: ["@/app/actions"] },
  ];
  assert.deepEqual(boundaryViolations(records).map(({ detail }) => detail), [
    "platform must not import modules: @/modules/projects/service",
    "modules must not import ui: ../../ui/project-card",
    "ui must not import app: @/app/actions",
  ]);
});

test("boundary analyzer rejects deferred module names", () => {
  const violations = boundaryViolations([
    { path: "src/modules/bank-integration/index.ts", imports: [] },
    { path: "src/app/page.tsx", imports: ["@/modules/configurable-approval-rules"] },
  ]);
  assert.equal(violations.length, 2);
  assert.ok(violations.every(({ detail }) => detail.startsWith("deferred identifier:")));
});

test("repository source obeys the declared dependency direction and scope", () => {
  assert.deepEqual(boundaryViolations(repositoryRecords()), []);
});
