import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement history truthfully shows unavailable movement data`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/products/product-1/movements?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "حركة المنتج" : "Product movement" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "بيانات الحركة غير متاحة بعد" : "Movement data is not available yet", { exact: true })).toBeVisible();
    await expect(page.getByText(ar ? /ليست رصيد مخزون أو تقييم مخزون/ : /not a stock balance or inventory valuation/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: ar ? "لا توجد حركات مطابقة" : "No matching movements" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("SSH-2026-0042", { exact: true })).toHaveCount(0);
    await expect(page.getByText("SCN-2026-0081", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name: ar ? "المنتجات" : "Products" })).toHaveAttribute("aria-current", "page");
  });
}

test("product movement history preserves selected filters while showing an empty traceability result", async ({ page }) => {
  await page.goto("/products/product-1/movements?locale=en&projectId=project-orion&direction=OUTBOUND");
  await expect(page.getByLabel("Direction")).toHaveValue("OUTBOUND");
  await expect(page.getByText("0 matching movements", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "No matching movements" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("SSH-2026-0042", { exact: true })).toHaveCount(0);
  await expect(page.getByText("6,000 kg", { exact: true })).toHaveCount(0);
});
