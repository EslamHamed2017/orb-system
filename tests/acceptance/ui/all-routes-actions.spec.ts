import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { operationIds as runtimeOperationIds } from "../../../src/modules/access/roles";

const OPENAPI = readFileSync(resolve(process.cwd(), "specs/001-orb-trade-operations/contracts/openapi.yaml"), "utf8");
const operationIds = [...OPENAPI.matchAll(/^\s{6}operationId: ([A-Za-z][A-Za-z0-9]*)$/gm)].map((match) => match[1]);
function mutationIds(source: string): string[] {
  const result: string[] = [];
  let mutation = false;
  for (const line of source.split(/\r?\n/)) {
    const method = line.match(/^    (get|post|put|patch|delete|head|options|trace):\s*$/)?.[1];
    if (method) { mutation = method !== "get" && method !== "head" && method !== "options"; continue; }
    if (/^  \/[^:]+:\s*$/.test(line)) { mutation = false; continue; }
    const operationId = line.match(/^      operationId: ([A-Za-z][A-Za-z0-9]*)\s*$/)?.[1];
    if (mutation && operationId) { result.push(operationId); mutation = false; }
  }
  return result;
}
const mutationOperationIds = mutationIds(OPENAPI);

const routes = [
  "/", "/sign-in",
  "/masters/customers", "/masters/suppliers",
  "/accounts", "/accounts/collections", "/accounts/expenses", "/accounts/sales-invoices", "/accounts/supplier-invoices", "/accounts/supplier-payments",
  "/admin/backup", "/admin/roles", "/admin/users", "/approvals", "/attachments",
  "/customers/demo", "/documents/demo", "/evidence/demo", "/masters/products", "/products/demo/movements",
  "/projects", "/projects/new", "/projects/demo/audit", "/projects/demo/claims", "/projects/demo/closure", "/projects/demo/contracts",
  "/projects/demo/documents", "/projects/demo/expenses", "/projects/demo/money", "/projects/demo/overview", "/projects/demo/profit",
  "/projects/demo/shipments", "/projects/demo/statements", "/projects/demo/transactions",
  "/reports", "/reports/accounts", "/reports/contract-fulfillment", "/reports/product-movement", "/reports/project-profitability",
  "/sales-invoices/demo/print", "/sales-shipments/demo", "/sales-shipments/demo?state=draft", "/settings", "/shipments",
  "/supplier-shipments/demo", "/supplier-shipments/demo?state=draft", "/suppliers/demo",
] as const;

const acceptanceOnlyRouteVariants = new Set(["/masters/customers", "/masters/suppliers", "/sales-shipments/demo?state=draft", "/supplier-shipments/demo?state=draft"]);

const asyncStates = ["loading", "empty", "error", "permission-denied", "offline", "stale-version"] as const;
const uiMutationOperationIds = new Set([
  "createCustomer", "updateCustomer", "createSupplier", "updateSupplier", "createProduct", "updateProduct", "createProjectWithSalesContract", "createPurchaseContract", "activateProject", "createContractAmendment",
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
  "cancelUnallocatedSupplierInvoice", "cancelUnallocatedSalesInvoice", "cancelDirectExpense", "signIn", "signOutCurrentSession", "assignFixedPilotRoles", "revokePilotUserSession",
  "startIsolatedRestoreTest", "createContractLine", "createMasterRecord", "createRole", "createSalesShipmentLine",
  "createSupplierShipmentLine", "createUser", "replaceRolePermissions", "updateMasterRecord", "updateSettings", "updateUser",
]);
const nonDirectMutationOperations: ReadonlyMap<string, string> = new Map([
  ["allocateShipmentLineSource", "composed inside the sales-shipment source-allocation workflow"],
  ["createSalesInvoice", "created from the finalized sales-shipment workflow, not the invoice register"],
  ["updateContractLine", "composed inside an amendment version rather than exposed as a standalone action"],
  ["changeOwnPassword", "inside the account dialog, rendered only after the avatar is opened"],
  ["resetUserPassword", "inside each user's manage panel on Users and access"],
] as const);

function pageRoutes(directory = resolve(process.cwd(), "src/app"), segments: string[] = []): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const routes = entries.some((entry) => entry.isFile() && entry.name === "page.tsx")
    ? [`/${segments.map((segment) => /^\[.+\]$/.test(segment) ? (segment === "[masterType]" ? "products" : "demo") : segment).join("/")}`.replace(/\/$/, "") || "/"]
    : [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory() && !candidate.name.startsWith("_") && candidate.name !== "api"))
    routes.push(...pageRoutes(resolve(directory, entry.name), [...segments, entry.name]));
  return routes;
}

async function assertRendered(page: Page, route: string, locale: "en" | "ar") {
  const separator = route.includes("?") ? "&" : "?";
  const response = await page.goto(`${route}${separator}locale=${locale}`);
  expect(response?.status(), `${route} must resolve`).toBeLessThan(400);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.locator("main h1, main [role=heading][aria-level='1']").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/application error|internal server error|coming soon|placeholder|not implemented/i);
}

test("the acceptance inventory covers every page and exhaustively classifies every mutation", async () => {
  const runtimeIds = runtimeOperationIds();
  expect(new Set(operationIds)).toEqual(new Set(runtimeIds));
  expect(new Set(operationIds).size).toBe(operationIds.length);
  expect(pageRoutes().sort()).toEqual([...routes].filter((route) => !acceptanceOnlyRouteVariants.has(route)).sort());
  expect(new Set([...uiMutationOperationIds, ...nonDirectMutationOperations.keys()])).toEqual(new Set(mutationOperationIds));
  expect([...uiMutationOperationIds].filter((id) => nonDirectMutationOperations.has(id))).toEqual([]);
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
  const persistedProjectId = "33333333-3333-7333-8333-333333333333";
  const version = { revisionNo: 1, effectiveDate: "2026-11-18", product: { id: "22222222-2222-7222-8222-222222222222", reference: "PROD-001", nameEn: "Yemen Matari", nameAr: "مطري يمني" }, quantity: "20.000000", unitPrice: "4100.000000", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Aden", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityUnder: "0.000000", quantityOver: "0.000000", netWeightUnder: "0.000000", netWeightOver: "0.000000", grossWeightUnder: "0.000000", grossWeightOver: "0.000000" } };
  const purchaseContract = { id: "66666666-6666-7666-8666-666666666666", reference: "ORB-PC-2026-000001", state: "DRAFT", version: 1, supplier: { id: "55555555-5555-7555-8555-555555555555", reference: "SUP-001", registeredName: "Coast Exporters", displayNameAr: "مصدرو الساحل" }, activeVersion: version };
  const persistedProject = { id: persistedProjectId, reference: "ORB-PRJ-2026-000001", lifecycleState: "DRAFT", managementCurrency: "USD", version: 2, customer: { id: "11111111-1111-7111-8111-111111111111", reference: "CUS-001", legalName: "Northstar Roasters", legalNameAr: "محمصة نورث ستار" }, salesContract: { id: "77777777-7777-7777-8777-777777777777", reference: "ORB-SC-2026-000001", state: "DRAFT", version: 1, activeVersion: version }, purchaseContracts: [purchaseContract] };
  await page.route(`**/api/projects/${persistedProjectId}`, route => route.fulfill({ status: 200, headers: { "x-orb-project-write-permitted": "true" }, contentType: "application/json", body: JSON.stringify(persistedProject) }));
  await page.goto(`/projects/${persistedProjectId}/overview?locale=en`);
  await expect(page.getByRole("button", { name: "Activate project" })).toHaveAttribute("data-operation-id", "activateProject");
  found.set("activateProject", 1);
  for (const route of routes) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}locale=en&role=owner-admin`);
    await expect(page.locator("main h1").first()).toBeVisible();
    for (const control of await page.locator("button[data-operation-id], a[data-operation-id], form[data-operation-id]").all()) {
      const id = await control.getAttribute("data-operation-id");
      if (id) found.set(id, (found.get(id) ?? 0) + 1);
    }
  }
  const missing = [...uiMutationOperationIds].filter((id) => !found.has(id)).sort();
  const unavailableWithoutDatabase = ["allocateMoneyMovement", "applyApprovedClaimOutcome", "applyApprovedExpenseCorrection", "assessProjectClosure", "assignFixedPilotRoles", "cancelDirectExpense", "cancelUnallocatedSalesInvoice", "cancelUnallocatedSupplierInvoice", "cancelUnexecutedProject", "confirmSalesShipment", "confirmSupplierInvoice", "confirmSupplierShipment", "createContractAmendment", "createContractLine", "createDirectExpense", "createProduct", "createProjectWithSalesContract", "createPurchaseContract", "createRole", "createSalesShipment", "createSalesShipmentLine", "createSupplier", "createSupplierInvoice", "createSupplierShipment", "createSupplierShipmentLine", "createUser", "decideFixedApproval", "finalCloseProject", "moveClaimUnderReview", "openSimpleClaim", "recordMoneyMovement", "reopenProject", "replaceRolePermissions", "requestClosureException", "requestToleranceException", "reverseMoneyMovement", "reverseSettlementAllocation", "reviseSalesShipmentDataset", "reviseSupplierShipmentDataset", "revokePilotUserSession", "setPrimarySupplierSource", "startIsolatedRestoreTest", "submitApprovedExpenseCorrection", "submitClaimOutcomeForApproval", "submitContractForApproval", "submitDirectExpense", "submitFinalCloseForApproval", "submitReopenForApproval", "submitSalesShipmentConfirmation", "submitSupplierInvoice", "submitSupplierShipmentConfirmation", "transitionSalesShipmentExecution", "transitionSupplierShipmentExecution", "updateCustomer", "updateProduct", "updateSupplier", "updateUser"].sort();
  const unknown = [...found].filter(([id]) => !operationIds.includes(id)).sort();
  expect(missing, "only database-backed mutation controls may be absent from the no-database preview").toEqual(unavailableWithoutDatabase);
  expect(unknown, "UI controls reference unknown contract operations").toEqual([]);
});
