import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { operationIds as runtimeOperationIds } from "../../../src/modules/access/roles";

const OPENAPI = readFileSync(resolve(process.cwd(), "specs/001-orb-trade-operations/contracts/openapi.yaml"), "utf8");
const operationIds = [...OPENAPI.matchAll(/^\s{6}operationId: ([A-Za-z][A-Za-z0-9]*)$/gm)].map((match) => match[1]);

const routes = [
  "/sign-in", "/", "/masters/customers", "/masters/suppliers", "/projects", "/projects/new", "/projects/demo/overview",
  "/projects/demo/contracts", "/projects/demo/shipments", "/sales-shipments/demo", "/supplier-shipments/demo",
  "/projects/demo/money", "/projects/demo/expenses", "/projects/demo/statements", "/projects/demo/profit",
  "/projects/demo/claims", "/projects/demo/closure", "/approvals", "/documents/demo", "/evidence/demo",
  "/projects/demo/audit", "/admin/users", "/admin/backup",
] as const;

const asyncStates = ["loading", "empty", "error", "permission-denied", "offline", "stale-version"] as const;
const uiMutationOperationIds = new Set([
  "createCustomer", "updateCustomer", "createSupplier", "updateSupplier", "createProjectWithSalesContract", "createPurchaseContract", "createContractAmendment",
  "submitContractForApproval", "createSupplierShipment", "submitSupplierShipmentConfirmation", "confirmSupplierShipment", "createSalesShipment",
  "setPrimarySupplierSource", "requestToleranceException", "confirmSalesShipment", "updateRouteEvidenceOrMilestone", "uploadEvidence",
  "generateShipmentDocument", "reviseDocument", "submitDocumentForApproval", "cancelDocumentRevision", "createOutboundManifest",
  "submitOutboundManifestForApproval", "sendApprovedOutboundManifest", "cancelOutboundManifest", "decideFixedApproval", "createSupplierInvoice",
  "submitSupplierInvoice", "confirmSupplierInvoice", "recordMoneyMovement", "allocateMoneyMovement", "reverseMoneyMovement",
  "createDirectExpense", "submitDirectExpense", "openSimpleClaim", "moveClaimUnderReview", "submitClaimOutcomeForApproval",
  "assessProjectClosure", "requestClosureException", "finalCloseProject", "submitFinalCloseForApproval", "reopenProject",
  "submitReopenForApproval", "reviseSupplierShipmentDataset", "reviseSalesShipmentDataset", "transitionSupplierShipmentExecution",
  "transitionSalesShipmentExecution", "reverseSettlementAllocation", "submitApprovedExpenseCorrection", "applyApprovedExpenseCorrection",
  "cancelUnexecutedProject", "applyApprovedClaimOutcome", "reviseOutboundManifest", "submitSalesShipmentConfirmation",
  "cancelUnallocatedSupplierInvoice", "signIn", "signOutCurrentSession", "assignFixedPilotRoles", "revokePilotUserSession",
  "startIsolatedRestoreTest",
]);

async function assertRendered(page: Page, route: string, locale: "en" | "ar") {
  const separator = route.includes("?") ? "&" : "?";
  const response = await page.goto(`${route}${separator}locale=${locale}`);
  expect(response?.status(), `${route} must resolve`).toBeLessThan(400);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.locator("main h1, main [role=heading][aria-level='1']").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/application error|internal server error|coming soon|placeholder|not implemented/i);
}

test("the acceptance inventory matches the runtime operation registry and all 23 concrete page files", async () => {
  const runtimeIds = runtimeOperationIds();
  expect(new Set(operationIds)).toEqual(new Set(runtimeIds));
  expect(new Set(operationIds).size).toBe(operationIds.length);
  expect(routes).toHaveLength(23);
  expect([...uiMutationOperationIds].filter((id) => !operationIds.includes(id))).toEqual([]);
});

for (const locale of ["en", "ar"] as const) {
  test(`${locale} renders every contracted page route with the correct document language and direction`, async ({ page }) => {
    for (const route of routes) await test.step(route, () => assertRendered(page, route, locale));
  });

  test(`${locale} exposes every common loading, empty, error, permission, offline and stale state`, async ({ page }) => {
    for (const state of asyncStates) {
      await page.goto(`/projects?locale=${locale}&demoState=${state}`);
      await expect(page.locator(`[data-async-state="${state}"]`)).toBeVisible();
      if (state !== "loading") await expect(page.locator(`[data-async-state="${state}"] button`)).toBeVisible();
    }
  });
}

test("every accepted UI mutation has one reachable named action bound to its exact operationId", async ({ page }) => {
  const found = new Map<string, number>();
  for (const route of routes) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}locale=en&role=owner-admin`);
    await expect(page.locator("main h1").first()).toBeVisible();
    for (const control of await page.locator("button[data-operation-id], a[data-operation-id], form[data-operation-id]").all()) {
      const id = await control.getAttribute("data-operation-id");
      if (id) found.set(id, (found.get(id) ?? 0) + 1);
    }
  }
  const missing = [...uiMutationOperationIds].filter((id) => !found.has(id)).sort();
  const unknown = [...found].filter(([id]) => !operationIds.includes(id)).sort();
  expect(missing, "accepted UI mutation controls missing exact operation bindings").toEqual([]);
  expect(unknown, "UI controls reference unknown contract operations").toEqual([]);
});
