import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement history preserves cross-project source traceability`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/products/product-1/movements?locale=${locale}`);
    await expect(page.getByRole("heading", { level:1, name:ar ? "حركة المنتج" : "Product movement" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? /ليست رصيد مخزون أو تقييم مخزون/ : /not a stock balance or inventory valuation/)).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("link", { name:"SSH-2026-0042" })).toHaveAttribute("href", new RegExp("/sales-shipments/shipment-42"));
    await expect(page.getByRole("link", { name:"SCN-2026-0081" })).toHaveAttribute("href", new RegExp("/supplier-shipments/container-81"));
    await expect(page.getByRole("navigation", { name:ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name:ar ? "المنتجات" : "Products" })).toHaveAttribute("aria-current", "page");
  });
}

test("product movement history filters by project and direction without presenting a stock balance", async ({ page }) => {
  await page.goto("/products/product-1/movements?locale=en&projectId=project-orion&direction=OUTBOUND");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("link", { name:"SSH-2026-0042" })).toBeVisible();
  await expect(page.getByText("SSH-2026-0045", { exact:true })).toHaveCount(0);
  await expect(page.getByText("1,250.5 kg", { exact:true })).toBeVisible();
  await expect(page.getByText("6,000 kg", { exact:true })).toHaveCount(0);
});
