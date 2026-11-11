import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} products master supports bilingual traceability and lifecycle controls`, async ({ page }) => {
    await page.goto(`/masters/coffee?locale=${locale}`);
    const ar = locale === "ar";
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المنتجات" : "Products" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? /من دون مخزون حر أو تقييم مخزون/ : /without free stock or inventory valuation/)).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("table").getByText(ar ? "غير نشط" : "Inactive", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: ar ? "تسجيل منتج" : "Register product" })).toHaveAttribute("href", "#product-registration");
    await page.getByText(ar ? "فتح نموذج تسجيل المنتج" : "Open product registration form").click();
    await expect(page.getByLabel(ar ? "المرجع" : "Reference")).toBeVisible();
    await expect(page.getByRole("button", { name: ar ? "حفظ المنتج" : "Save product" })).toHaveAttribute("data-operation-id", "createMasterRecord");
    await expect(page.getByRole("navigation", { name: ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name: ar ? "المنتجات" : "Products" })).toHaveAttribute("aria-current", "page");
  });
}

test("products master filters by lifecycle status and product reference", async ({ page }) => {
  await page.goto("/masters/coffee?locale=en&status=INACTIVE&q=PROD-003");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByText("PROD-003", { exact: false })).toBeVisible();
  await expect(page.getByText("PROD-001", { exact: false })).toHaveCount(0);
});
