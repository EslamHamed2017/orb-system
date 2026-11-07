import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Role = "OWNER_ADMIN" | "OPERATIONS" | "FINANCE_VIEWER";
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Operation = Readonly<{
  id: string;
  method: Method;
  path: string;
  roles: readonly Role[];
  controls: ReadonlySet<"Idempotency-Key" | "X-CSRF-Token" | "If-Match">;
}>;
type Invocation = Readonly<{
  role: Role | "UNAUTHENTICATED";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  expectedStatuses?: number[];
}>;
type Fixture = Readonly<{ allowed: Invocation; denied: Invocation }>;
type Session = Readonly<{ cookie: string; csrfToken: string }>;
type DeployedConfiguration = Readonly<{
  targetUrl: string;
  candidateDigest: string;
  environmentId: string;
  e01Passed: true;
  origin: string;
  sessions: Record<Role, Session>;
  operations: Record<string, Fixture>;
}>;
type Binding = Readonly<{ targetOrigin: string; candidateDigest: string; environmentId: string; e01Passed: true }>;

const ROOT = resolve(import.meta.dirname, "../..");
const OPENAPI_PATH = resolve(ROOT, "specs/001-orb-trade-operations/contracts/openapi.yaml");
const CONTROL_REFS = {
  IdempotencyKey: "Idempotency-Key",
  CsrfToken: "X-CSRF-Token",
  IfMatch: "If-Match",
} as const;
const ALL_ROLES = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"] as const;
const METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const EXPECTED_COUNTS = { operations: 79, idempotency: 58, csrf: 57, ifMatch: 53 } as const;
const EXPECTED_ROLE_GROUPS: ReadonlyArray<readonly [readonly Role[], readonly string[]]> = [
  [ALL_ROLES, ["listMasterRecords", "listProjects", "getProject", "getFixedRouteChecklist", "getEvidenceMetadata", "viewOrDownloadEvidence", "getDocumentGenerationStatus", "getOperationalStatement", "getProjectMarginAndCash", "requestClosureException", "submitFinalCloseForApproval", "submitReopenForApproval", "listProjectAuditEvents", "listSupplierShipmentDatasetHistory", "listSalesShipmentDatasetHistory", "getOutboundManifestExactPreview", "listOutboundSendAttempts", "signOutCurrentSession", "getSupplierShipmentWorkspace", "getSalesShipmentWorkspace"]],
  [["OWNER_ADMIN", "OPERATIONS"], ["createMasterRecord", "updateMasterRecord", "createProjectWithSalesContract", "createPurchaseContract", "createContractAmendment", "submitContractForApproval", "createSupplierShipment", "submitSupplierShipmentConfirmation", "confirmSupplierShipment", "createSalesShipment", "setPrimarySupplierSource", "requestToleranceException", "confirmSalesShipment", "updateRouteEvidenceOrMilestone", "uploadEvidence", "generateShipmentDocument", "reviseDocument", "submitDocumentForApproval", "cancelDocumentRevision", "createOutboundManifest", "submitOutboundManifestForApproval", "sendApprovedOutboundManifest", "cancelOutboundManifest", "createDirectExpense", "submitDirectExpense", "openSimpleClaim", "moveClaimUnderReview", "submitClaimOutcomeForApproval", "assessProjectClosure", "reviseSupplierShipmentDataset", "reviseSalesShipmentDataset", "transitionSupplierShipmentExecution", "transitionSalesShipmentExecution", "submitApprovedExpenseCorrection", "applyApprovedExpenseCorrection", "applyApprovedClaimOutcome", "reviseOutboundManifest", "submitSalesShipmentConfirmation"]],
  [["OWNER_ADMIN"], ["listFixedApprovalInbox", "decideFixedApproval", "finalCloseProject", "reopenProject", "cancelUnexecutedProject", "listPilotUsers", "assignFixedPilotRoles", "revokePilotUserSession", "getBackupRecoveryStatus", "startIsolatedRestoreTest", "getIsolatedRestoreTest", "listPilotUserSessions"]],
  [["OWNER_ADMIN", "FINANCE_VIEWER"], ["createSupplierInvoice", "submitSupplierInvoice", "confirmSupplierInvoice", "recordMoneyMovement", "allocateMoneyMovement", "reverseMoneyMovement", "reverseSettlementAllocation", "cancelUnallocatedSupplierInvoice"]],
];

function parseOperations(source: string): Operation[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const operations: Array<{ id?: string; method: Method; path: string; roles: Role[]; controls: Set<"Idempotency-Key" | "X-CSRF-Token" | "If-Match"> }> = [];
  let path = "";
  let current: (typeof operations)[number] | undefined;
  let readingRoles = false;
  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) { path = pathMatch[1]; current = undefined; readingRoles = false; continue; }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (methodMatch && METHODS.has(methodMatch[1])) {
      current = { method: methodMatch[1].toUpperCase() as Method, path, roles: [], controls: new Set() };
      operations.push(current); readingRoles = false; continue;
    }
    if (!current) continue;
    const idMatch = line.match(/^      operationId: ([A-Za-z][A-Za-z0-9]*)\s*$/);
    if (idMatch) { current.id = idMatch[1]; continue; }
    const controlMatch = line.match(/^      - \$ref: '#\/components\/parameters\/(IdempotencyKey|CsrfToken|IfMatch)'\s*$/);
    if (controlMatch) { current.controls.add(CONTROL_REFS[controlMatch[1] as keyof typeof CONTROL_REFS]); continue; }
    if (/^      x-required-roles:\s*\[\]\s*$/.test(line)) { current.roles = []; readingRoles = false; continue; }
    if (/^      x-required-roles:\s*$/.test(line)) { readingRoles = true; continue; }
    if (readingRoles) {
      const roleMatch = line.match(/^      - (OWNER_ADMIN|OPERATIONS|FINANCE_VIEWER)\s*$/);
      if (roleMatch) { current.roles.push(roleMatch[1] as Role); continue; }
      readingRoles = false;
    }
  }
  expect(operations.every((operation) => operation.id && operation.path)).toBe(true);
  return operations as Operation[];
}

const operations = parseOperations(readFileSync(OPENAPI_PATH, "utf8"));
const expectedRoles = new Map<string, readonly Role[]>(EXPECTED_ROLE_GROUPS.flatMap(([roles, ids]) => ids.map((id) => [id, roles])));
expectedRoles.set("signIn", []);

function assertInventory(): void {
  expect(operations).toHaveLength(EXPECTED_COUNTS.operations);
  expect(new Set(operations.map(({ id }) => id)).size).toBe(EXPECTED_COUNTS.operations);
  expect(operations.filter(({ controls }) => controls.has("Idempotency-Key"))).toHaveLength(EXPECTED_COUNTS.idempotency);
  expect(operations.filter(({ controls }) => controls.has("X-CSRF-Token"))).toHaveLength(EXPECTED_COUNTS.csrf);
  expect(operations.filter(({ controls }) => controls.has("If-Match"))).toHaveLength(EXPECTED_COUNTS.ifMatch);
  expect(expectedRoles.size).toBe(EXPECTED_COUNTS.operations);
  for (const operation of operations) expect([...operation.roles].sort(), operation.id).toEqual([...(expectedRoles.get(operation.id) ?? [])].sort());
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

function parseRequiredJson(name: "ORB_E02_DEPLOYED_CONFIG" | "ORB_E02_FORBIDDEN_CONFIG"): unknown {
  const raw = process.env[name];
  expect(raw, `${name} must be set for a deployed E02 run`).toBeTruthy();
  expect(() => JSON.parse(raw!), `${name} must be valid JSON`).not.toThrow();
  return JSON.parse(raw!);
}

function deployedConfiguration(): { config: DeployedConfiguration; binding: Binding } {
  expect(process.env.ORB_E02_MODE, "Set ORB_E02_MODE=deployed for runtime evidence, or dry-run for non-evidence inventory validation").toBe("deployed");
  const config = parseRequiredJson("ORB_E02_DEPLOYED_CONFIG") as DeployedConfiguration;
  const binding = bindingFrom(config, "ORB_E02_DEPLOYED_CONFIG");
  const forbiddenBinding = bindingFrom(parseRequiredJson("ORB_E02_FORBIDDEN_CONFIG"), "ORB_E02_FORBIDDEN_CONFIG");
  expect(forbiddenBinding, "both E02 configs must bind the exact same deployed candidate/environment").toEqual(binding);
  expect(new URL(config.origin).origin).toBe(binding.targetOrigin);
  for (const role of ALL_ROLES) {
    expect(config.sessions?.[role]?.cookie, `missing ${role} deployed session cookie`).toMatch(/__Host-orb_session=/);
    expect(typeof config.sessions?.[role]?.csrfToken, `missing ${role} deployed CSRF token`).toBe("string");
    expect(config.sessions[role].csrfToken.length).toBeGreaterThanOrEqual(32);
  }
  expect(Object.keys(config.operations ?? {}).sort()).toEqual(operations.map(({ id }) => id).sort());
  return { config, binding };
}

function requestHeaders(operation: Operation, invocation: Invocation, config: DeployedConfiguration, allowed: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json, application/problem+json", ...invocation.headers };
  if (invocation.role !== "UNAUTHENTICATED") {
    const session = config.sessions[invocation.role];
    headers.Cookie = session.cookie;
    if (operation.controls.has("X-CSRF-Token")) headers["X-CSRF-Token"] = session.csrfToken;
  }
  if (operation.controls.has("Idempotency-Key")) headers["Idempotency-Key"] = `e02-${allowed ? "allowed" : "denied"}-${operation.id}-0001`;
  if (operation.controls.has("If-Match")) headers["If-Match"] = invocation.headers?.["If-Match"] ?? '"1"';
  if (operation.controls.has("X-CSRF-Token")) { headers.Origin = config.origin; headers.Referer = `${config.origin}/`; }
  return headers;
}

async function invoke(request: APIRequestContext, operation: Operation, invocation: Invocation, config: DeployedConfiguration, allowed: boolean): Promise<APIResponse> {
  const url = new URL(invocation.path, config.targetUrl);
  for (const [name, value] of Object.entries(invocation.query ?? {})) url.searchParams.set(name, value);
  return request.fetch(url.toString(), {
    method: operation.method,
    headers: requestHeaders(operation, invocation, config, allowed),
    data: invocation.body,
    failOnStatusCode: false,
  });
}

async function expectProblem(response: APIResponse, operationId: string): Promise<void> {
  expect(response.headers()["content-type"] ?? "", operationId).toMatch(/^application\/problem\+json(?:;|$)/i);
  const body = await response.json() as Record<string, unknown>;
  expect(body.type, operationId).toEqual(expect.any(String));
  expect(() => new URL(String(body.type))).not.toThrow();
  expect(body.title, operationId).toEqual(expect.any(String));
  expect(body.detail, operationId).toEqual(expect.any(String));
  expect(body.status, operationId).toBe(response.status());
  expect(body.code, operationId).toMatch(/^[A-Z][A-Z0-9_]+$/);
  expect(body.correlationId, operationId).toEqual(expect.any(String));
}

test.describe("ORB-R1-1302 deployed-target operation sweep", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "the E02 API sweep executes exactly once");

  test("contract construction has exactly 79 operations and exact role/control inventories", async () => {
    assertInventory();
    if (process.env.ORB_E02_MODE === "dry-run") {
      test.info().annotations.push({ type: "non-evidence", description: "Local construction validation only; this does not earn E02." });
      return;
    }
    deployedConfiguration();
  });

  test("invokes every operation exactly once allowed and once denied or invalid", async ({ request }, testInfo) => {
    test.skip(process.env.ORB_E02_MODE === "dry-run", "dry-run never calls a target and cannot earn E02");
    assertInventory();
    const { config, binding } = deployedConfiguration();
    const seenAllowed = new Set<string>();
    const seenDenied = new Set<string>();
    const results: Array<{ operationId: string; allowedStatus: number; deniedInvalidStatus: number }> = [];
    for (const operation of operations) {
      const fixture = config.operations[operation.id];
      expect(fixture, `missing fixture for ${operation.id}`).toBeTruthy();
      if (operation.id === "signIn") {
        expect(fixture.allowed.role).toBe("UNAUTHENTICATED");
        expect(fixture.denied.role).toBe("UNAUTHENTICATED");
      } else {
        expect(operation.roles, `${operation.id} allowed role is outside x-required-roles`).toContain(fixture.allowed.role);
        expect(operation.roles, `${operation.id} denied role is accidentally allowed`).not.toContain(fixture.denied.role as Role);
      }

      const allowed = await invoke(request, operation, fixture.allowed, config, true);
      seenAllowed.add(operation.id);
      expect(fixture.allowed.expectedStatuses ?? [200, 201, 202, 204], `${operation.id} allowed status ${allowed.status()}`).toContain(allowed.status());

      const denied = await invoke(request, operation, fixture.denied, config, false);
      seenDenied.add(operation.id);
      expect(fixture.denied.expectedStatuses ?? [400, 401, 403, 404, 409, 412, 422, 428], `${operation.id} denied/invalid status ${denied.status()}`).toContain(denied.status());
      await expectProblem(denied, operation.id);
      results.push({ operationId: operation.id, allowedStatus: allowed.status(), deniedInvalidStatus: denied.status() });
    }
    expect(seenAllowed.size).toBe(EXPECTED_COUNTS.operations);
    expect(seenDenied.size).toBe(EXPECTED_COUNTS.operations);
    expect(results).toHaveLength(EXPECTED_COUNTS.operations);
    await testInfo.attach("e02-operation-sweep-report.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({
        binding,
        totals: { allowed: seenAllowed.size, deniedInvalid: seenDenied.size, idempotency: EXPECTED_COUNTS.idempotency, csrf: EXPECTED_COUNTS.csrf, ifMatch: EXPECTED_COUNTS.ifMatch },
        operations: results,
      }, null, 2)),
    });
  });
});
