import { expect, test, type Page } from "@playwright/test";

/** A product's movements read /api/products/{id}/movements; these checks stub it. */
const PRODUCT = "44444444-4444-7444-8444-444444444444";
const PROJECT = "33333333-3333-7333-8333-333333333333";
const item = (over: Record<string, unknown>) => ({ id: "in-s1", occurredOn: "2026-11-18", occurredAt: "2026-11-18T10:00:00Z", direction: "INBOUND", productId: PRODUCT, productReference: "PROD-001", productName: "Ethiopia Yirgacheffe", projectId: PROJECT, projectReference: "ORB-PRJ-2026-000014", projectName: "Hamburg Roasters GmbH", quantity: "19.2", unit: "MT", transactionType: "SUPPLIER_CONTAINER", transactionId: "s1", transactionReference: "IN-0001", counterpartyName: "Aden Coffee Exporters", contractLineReference: "ORB-PC-2026-000011/L1", sourceAllocationCount: 0, ...over });
async function stub(page: Page, items: unknown[]) {
  await page.route(`**/api/products/${PRODUCT}/movements*`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ productId: PRODUCT, product: { id: PRODUCT, reference: "PROD-001", nameEn: "Ethiopia Yirgacheffe", nameAr: "يرغاتشيفي إثيوبيا" }, items }) }));
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement history shows the product's live movements`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page, [item({}), item({ id: "out-s2", direction: "OUTBOUND", transactionType: "SALES_SHIPMENT", transactionId: "s2", transactionReference: "OUT-0001", counterpartyName: "Hamburg Roasters GmbH" })]);
    await page.goto(`/products/${PRODUCT}/movements?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "حركة المنتج" : "Product movement" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "يرغاتشيفي إثيوبيا" : "Ethiopia Yirgacheffe", { exact: true })).toBeVisible();
    await expect(page.getByText(ar ? /ليست رصيد مخزون أو تقييم مخزون/ : /not a stock balance or inventory valuation/)).toBeVisible();
    await expect(page.getByRole("table").getByRole("link", { name: "OUT-0001" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name: ar ? "المبيعات" : "Sales" })).toHaveAttribute("aria-current", "page");
  });
}

test("product movement history keeps the selected filters and shows an empty result", async ({ page }) => {
  await stub(page, [item({})]);
  await page.goto(`/products/${PRODUCT}/movements?locale=en&direction=OUTBOUND`);
  await expect(page.getByLabel("Direction")).toHaveValue("OUTBOUND");
  await expect(page.getByText("0 matching movements", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "No matching movements" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
