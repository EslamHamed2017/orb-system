import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Operation = { method: string; path: string; operationId: string; roles: readonly string[] };
const source = readFileSync(resolve(process.cwd(), "specs/001-orb-trade-operations/contracts/openapi.yaml"), "utf8");
const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
function operations(): Operation[] {
  const lines = source.split(/\r?\n/), result: Operation[] = [];
  let path = "", method = "", operationId = "", roles: string[] = [], readingRoles = false;
  const flush = () => { if (path && method && operationId) result.push({ path, method, operationId, roles }); operationId = ""; roles = []; readingRoles = false; };
  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[^:]+):$/);
    if (pathMatch) { flush(); path = pathMatch[1]; method = ""; continue; }
    const methodMatch = line.match(/^    ([a-z]+):$/);
    if (methodMatch && methods.has(methodMatch[1])) { flush(); method = methodMatch[1]; continue; }
    const idMatch = line.match(/^      operationId: (\S+)$/);
    if (idMatch) { operationId = idMatch[1]; continue; }
    if (/^      x-required-roles:$/.test(line)) { readingRoles = true; continue; }
    const roleMatch = readingRoles ? line.match(/^      - (OWNER_ADMIN|OPERATIONS|FINANCE_VIEWER)$/) : null;
    if (roleMatch) { roles.push(roleMatch[1]); continue; }
    if (readingRoles && !/^\s*$/.test(line)) readingRoles = false;
  }
  flush(); return result;
}
const contractOperations = operations();
function concretePath(path: string): string {
  const values: Record<string, string> = {
    masterType: "customers", recordId: "demo", projectId: "demo", contractId: "demo", shipmentId: "demo", itemId: "demo",
    evidenceId: "demo", documentId: "demo", approvalId: "demo", invoiceId: "demo", movementId: "demo", allocationId: "demo",
    expenseId: "demo", statementType: "project", subjectId: "demo", claimId: "demo", manifestId: "demo", userId: "demo",
    sessionId: "demo", restoreTestId: "demo",
  };
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => values[name] ?? "demo");
}
async function directCall(request: APIRequestContext, operation: Operation) {
  return request.fetch(`/api${concretePath(operation.path)}`, {
    method: operation.method.toUpperCase(),
    headers: { "content-type": "application/json", accept: "application/problem+json" },
    data: {},
    failOnStatusCode: false,
  });
}

test("all 79 operations have a fixed role declaration, with sign-in as the only public operation", async () => {
  expect(contractOperations).toHaveLength(79);
  expect(new Set(contractOperations.map(({ operationId }) => operationId)).size).toBe(79);
  expect(contractOperations.filter(({ roles }) => roles.length === 0).map(({ operationId }) => operationId)).toEqual(["signIn"]);
  for (const operation of contractOperations.filter(({ operationId }) => operationId !== "signIn"))
    expect(operation.roles.length, `${operation.operationId} has no fixed role`).toBeGreaterThan(0);
});

test("anonymous direct calls to every protected operation fail closed with a safe problem response", async ({ request }) => {
  for (const operation of contractOperations.filter(({ operationId }) => operationId !== "signIn")) {
    await test.step(operation.operationId, async () => {
      const response = await directCall(request, operation);
      expect([401, 403], `${operation.method.toUpperCase()} ${operation.path} returned ${response.status()}`).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain("application/problem+json");
      const body = await response.json();
      expect(body).toMatchObject({ status: response.status(), correlationId: expect.any(String) });
      expect(JSON.stringify(body)).not.toMatch(/password|credential|secret|stack|sql|prisma/i);
    });
  }
});

for (const role of ["operations", "finance-viewer"] as const) {
  test(`${role} UI hides owner-only actions instead of relying on server denial`, async ({ page }) => {
    for (const route of ["/approvals", "/admin/users", "/admin/backup", "/projects/demo/closure"]) {
      await page.goto(`${route}?locale=en&role=${role}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator('[data-required-role="OWNER_ADMIN"]')).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(/start isolated restore test|assign fixed roles|revoke exact session|approve final close|reopen project/i);
    }
  });
}

test("Finance Viewer receives read-only operational screens with no mutation-bound control", async ({ page }) => {
  for (const route of ["/projects", "/projects/demo/overview", "/projects/demo/contracts", "/projects/demo/shipments", "/projects/demo/money", "/projects/demo/expenses", "/projects/demo/statements", "/projects/demo/profit", "/sales-shipments/demo", "/supplier-shipments/demo"]) {
    await page.goto(`${route}?locale=en&role=finance-viewer`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator("main button[data-operation-id], main form[data-operation-id]")).toHaveCount(0);
  }
});
