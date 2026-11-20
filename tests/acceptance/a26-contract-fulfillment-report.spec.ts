import { expect, test, type Page } from "@playwright/test";

/** The contract fulfillment report reads /api/reports/contract-fulfillment; these checks stub it. */
const PROJECT = "33333333-3333-7333-8333-333333333333";
const line = (over: Record<string, unknown>) => ({ id: "c1", approvedOn: "2026-11-02", contractType: "SALES", contractId: "c1", contractReference: "ORB-SC-2026-000004", lineNumber: 1, projectId: PROJECT, projectReference: "ORB-PRJ-2026-000014", productId: "p1", productReference: "PROD-001", productName: "Ethiopia Yirgacheffe", counterpartyName: "Hamburg Roasters GmbH", contractedQuantity: "100", fulfilledQuantity: "19.2", unit: "MT", contractedValue: "610000", fulfilledValue: "117120", currency: "USD", ...over });
const ROWS = [line({}), line({ id: "c2", contractId: "c2", contractType: "PURCHASE", contractReference: "ORB-PC-2026-000011", counterpartyName: "Aden Coffee Exporters", fulfilledQuantity: "100", fulfilledValue: "520050", contractedValue: "520050" })];
async function stub(page: Page, status = 200) {
  await page.route("**/api/reports/contract-fulfillment*", (route) => status === 200
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportType: "CONTRACT_FULFILLMENT", rows: ROWS }) })
    : route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ status, code: "PERMISSION_DENIED" }) }));
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} contract fulfillment report filters and links live contract lines`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page);
    await page.goto(`/reports/contract-fulfillment?locale=${locale}&projectId=${PROJECT}&contractType=SALES&status=OPEN`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "تقرير تنفيذ العقود" : "Contract fulfillment report" })).toBeVisible();
    await expect(page.getByRole("form", { name: ar ? "مرشحات تقرير تنفيذ العقود" : "Contract fulfillment report filters" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ORB-SC-2026-000004 · 1" })).toHaveAttribute("href", `/projects/${PROJECT}/contracts?locale=${locale}&contractId=c1`);
    await expect(page.getByRole("link", { name: "ORB-PRJ-2026-000014" })).toHaveAttribute("href", `/projects/${PROJECT}/overview?locale=${locale}`);
    await expect(page.getByText("80.8 MT", { exact: true })).toBeVisible();
    await expect(page.getByText("ORB-PC-2026-000011 · 1")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: ar ? "المشروع" : "Project" })).toHaveValue(PROJECT);
  });
}

test("Operations see that the report is for Owner and Finance", async ({ page }) => {
  await stub(page, 403);
  await page.goto("/reports/contract-fulfillment?locale=en");
  await expect(page.getByText("Your role cannot see this report.")).toBeVisible();
});
