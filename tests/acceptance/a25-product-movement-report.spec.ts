import { expect, test, type Page } from "@playwright/test";

/** The product movement report reads /api/reports/product-movement; these checks stub it. */
const PROJECT = "33333333-3333-7333-8333-333333333333";
const move = (over: Record<string, unknown>) => ({ id: "in-s1", occurredOn: "2026-11-18", occurredAt: "2026-11-18T10:00:00Z", direction: "INBOUND", productId: "44444444-4444-7444-8444-444444444444", productReference: "PROD-001", productName: "Ethiopia Yirgacheffe", projectId: PROJECT, projectReference: "ORB-PRJ-2026-000014", projectName: "Hamburg Roasters GmbH", quantity: "19.2", unit: "MT", transactionType: "SUPPLIER_CONTAINER", transactionId: "s1", transactionReference: "IN-0001", counterpartyName: "Aden Coffee Exporters", contractLineReference: "ORB-PC-2026-000011/L1", sourceAllocationCount: 0, ...over });
const ROWS = [move({}), move({ id: "out-s2", occurredOn: "2026-11-19", direction: "OUTBOUND", transactionType: "SALES_SHIPMENT", transactionId: "s2", transactionReference: "OUT-0001", counterpartyName: "Hamburg Roasters GmbH", quantity: "18", contractLineReference: "ORB-SC-2026-000004/L1" })];
async function stub(page: Page, rows: unknown[] = ROWS) {
  await page.route("**/api/reports/product-movement*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportType: "PRODUCT_MOVEMENT", rows }) }));
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement report traces live inbound and outbound shipments`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page);
    await page.goto(`/reports/product-movement?locale=${locale}&direction=OUTBOUND`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "تقرير حركة المنتج" : "Product movement report" })).toBeVisible();
    await expect(page.getByRole("form", { name: ar ? "مرشحات تقرير حركة المنتج" : "Product movement report filters" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "OUT-0001" })).toHaveAttribute("href", /\/sales-shipments\/s2\?/);
    await expect(table.getByText("IN-0001")).toHaveCount(0);
    await expect(page.getByText(ar ? /ليس رصيد مخزون أو تقييم مخزون/ : /not a stock balance or inventory valuation/)).toBeVisible();
  });
}

test("an empty result says so truthfully", async ({ page }) => {
  await stub(page, []);
  await page.goto("/reports/product-movement?locale=en");
  await expect(page.getByRole("status")).toHaveText("No matching approved movements.");
  await expect(page.getByRole("table")).toHaveCount(0);
});
