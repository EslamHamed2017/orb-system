import { expect, test, type APIResponse } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type Category = "api" | "schema" | "navigation" | "build";
type ForbiddenProbe = Readonly<{ category: Category; path: string }>;
type ForbiddenConfiguration = Readonly<{
  targetUrl: string;
  candidateDigest: string;
  environmentId: string;
  e01Passed: true;
  probes: ForbiddenProbe[];
}>;
type Binding = Readonly<{ targetOrigin: string; candidateDigest: string; environmentId: string; e01Passed: true }>;

const ROOT = resolve(import.meta.dirname, "../..");
const CONTRACT_ROOT = resolve(ROOT, "specs/001-orb-trade-operations");
const DEFERRED = /bank(?:-|_|\s)*(?:import|match|ingestion)|tax(?:-|_|\s)*(?:pack|engine|filing)|historical(?:-|_|\s)*migration|(?:multiple|secondary)(?:-|_|\s)*(?:supplier|shipment)?(?:-|_|\s)*sources?|shared(?:-|_|\s)*expense|approval(?:-|_|\s)*(?:designer|rules?)|route(?:-|_|\s)*(?:designer|templates?)|advanced(?:-|_|\s)*claim(?:-|_|\s)*settlement/i;
const CATEGORIES: Category[] = ["api", "schema", "navigation", "build"];
const REQUIRED_API_PATHS = [
  "/bank-imports", "/tax-packs", "/migration-records", "/source-allocations", "/expense-allocations", "/approval-policies", "/route-templates",
] as const;

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

function assertStaticAbsence(): void {
  const appRoot = resolve(ROOT, "src/app");
  const routeInventory = filesBelow(appRoot)
    .filter((path) => /\/(?:page|route)\.tsx?$/.test(path))
    .map((path) => path.slice(appRoot.length).replace(/\\/g, "/"));
  expect(routeInventory.length, "application page/API route inventory must exist").toBeGreaterThan(0);
  for (const route of routeInventory) expect(route, `application route inventory: ${route}`).not.toMatch(DEFERRED);

  const navigationPath = resolve(ROOT, "src/ui/navigation/AppNavigation.tsx");
  const navigationSource = readFileSync(navigationPath, "utf8");
  const navigationInventory = [...navigationSource.matchAll(/(?:href=|href\s*=\s*\{)[^\n]*?[`"'](\/[A-Za-z0-9_?=${}/.\[\]-]*)[`"']/g)].map((match) => match[1]);
  expect(navigationInventory.length, "navigation href inventory must exist").toBeGreaterThan(0);
  for (const route of navigationInventory) expect(route, `navigation inventory: ${route}`).not.toMatch(DEFERRED);

  const openapi = readFileSync(resolve(CONTRACT_ROOT, "contracts/openapi.yaml"), "utf8");
  const structuralApiInventory = openapi.split(/\r?\n/).filter((line) => /^  \/[^:]+:|^      operationId:|^    [A-Za-z][A-Za-z0-9]+:$|^        [A-Za-z][A-Za-z0-9]+:$/.test(line));
  expect(structuralApiInventory.length, "structured API/schema inventory must exist").toBeGreaterThan(79);
  expect(structuralApiInventory.join("\n"), "structured OpenAPI inventory").not.toMatch(DEFERRED);

  const manifests = filesBelow(resolve(ROOT, ".next")).filter((path) => /(?:app-path-routes|build|routes)-manifest.*\.(?:json|js)$/.test(path));
  for (const path of manifests) expect(readFileSync(path, "utf8"), path).not.toMatch(DEFERRED);
}

function parseRequiredJson(name: "ORB_E02_DEPLOYED_CONFIG" | "ORB_E02_FORBIDDEN_CONFIG"): unknown {
  const raw = process.env[name];
  expect(raw, `${name} must be set for a deployed E02 run`).toBeTruthy();
  expect(() => JSON.parse(raw!), `${name} must be valid JSON`).not.toThrow();
  return JSON.parse(raw!);
}

function bindingFrom(raw: unknown, label: string): Binding {
  expect(raw && typeof raw === "object", `${label} must be a JSON object`).toBe(true);
  const value = raw as Record<string, unknown>;
  expect(typeof value.targetUrl, `${label}.targetUrl must be a string`).toBe("string");
  const target = new URL(value.targetUrl as string);
  expect(target.protocol, `${label} target must use HTTPS`).toBe("https:");
  expect(["localhost", "127.0.0.1", "::1"], `${label} cannot target a local/predeployment server`).not.toContain(target.hostname);
  expect(value.candidateDigest, `${label}.candidateDigest`).toMatch(/^[a-f0-9]{64}$/);
  expect(typeof value.environmentId, `${label}.environmentId must be a string`).toBe("string");
  expect((value.environmentId as string).trim().length, `${label}.environmentId must not be blank`).toBeGreaterThan(0);
  expect(value.e01Passed, `${label} must attest E01 for this exact binding`).toBe(true);
  return { targetOrigin: target.origin, candidateDigest: value.candidateDigest as string, environmentId: value.environmentId as string, e01Passed: true };
}

function configuration(): { config: ForbiddenConfiguration; binding: Binding } {
  expect(process.env.ORB_E02_MODE, "Set ORB_E02_MODE=deployed or explicitly choose dry-run").toBe("deployed");
  const config = parseRequiredJson("ORB_E02_FORBIDDEN_CONFIG") as ForbiddenConfiguration;
  const binding = bindingFrom(config, "ORB_E02_FORBIDDEN_CONFIG");
  const deployedBinding = bindingFrom(parseRequiredJson("ORB_E02_DEPLOYED_CONFIG"), "ORB_E02_DEPLOYED_CONFIG");
  expect(deployedBinding, "both E02 configs must bind the exact same deployed candidate/environment").toEqual(binding);
  expect(new Set(config.probes.map(({ category }) => category))).toEqual(new Set(CATEGORIES));
  expect(config.probes.length).toBeGreaterThanOrEqual(CATEGORIES.length);
  for (const probe of config.probes) {
    expect(probe.path).toMatch(/^\//);
    expect(probe.path).toMatch(DEFERRED);
  }
  const apiPaths = config.probes.filter(({ category }) => category === "api").map(({ path }) => path);
  for (const path of REQUIRED_API_PATHS) expect(apiPaths.filter((candidate) => candidate === path), `required spec-named API probe ${path} must appear exactly once`).toHaveLength(1);
  return { config, binding };
}

async function expectNotFoundProblem(response: APIResponse, label: string): Promise<void> {
  expect(response.status(), label).toBe(404);
  expect(response.headers()["content-type"] ?? "", label).toMatch(/^application\/problem\+json(?:;|$)/i);
  const body = await response.json() as Record<string, unknown>;
  expect(body.status, label).toBe(404);
  expect(body.code, label).toBe("RESOURCE_NOT_FOUND");
  expect(body.type, label).toEqual(expect.any(String));
  expect(body.title, label).toEqual(expect.any(String));
  expect(body.detail, label).toEqual(expect.any(String));
  expect(body.correlationId, label).toEqual(expect.any(String));
}

test.describe("ORB-R1-1302 forbidden Release 1 surfaces", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "the E02 forbidden crawl executes exactly once");

  test("schema, navigation and built route inventories contain no deferred surface", () => {
    assertStaticAbsence();
    if (process.env.ORB_E02_MODE === "dry-run") test.info().annotations.push({ type: "non-evidence", description: "Static predeployment check only; this does not earn E02." });
    else configuration();
  });

  test("representative deployed API, schema, navigation and build paths all return RFC 9457 404", async ({ request }, testInfo) => {
    test.skip(process.env.ORB_E02_MODE === "dry-run", "dry-run never calls a target and cannot earn E02");
    const { config, binding } = configuration();
    const results: Array<{ category: Category; path: string; status: number }> = [];
    for (const probe of config.probes) {
      const response = await request.get(new URL(probe.path, config.targetUrl).toString(), { failOnStatusCode: false, headers: { Accept: "application/problem+json" } });
      await expectNotFoundProblem(response, `${probe.category}:${probe.path}`);
      results.push({ category: probe.category, path: probe.path, status: response.status() });
    }
    await testInfo.attach("e02-forbidden-paths-report.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({ binding, probes: results }, null, 2)),
    });
  });
});
