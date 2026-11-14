import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} project Accounts filters sales invoices and preserves 360 links`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts/sales-invoices?projectId=project-1&locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "فواتير المبيعات" : "Sales invoices" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("navigation", { name: ar ? "مساحة عمل المشروع" : "Project workspace" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText("SINV-2026-014")).toBeVisible();
    await expect(table.getByText("SINV-2026-013")).toHaveCount(0);
    await expect(table.getByRole("link", { name: "sales-shipment-1" })).toHaveAttribute("href", `/sales-shipments/sales-shipment-1?locale=${locale}`);
    await expect(page.getByText(ar ? "1 فاتورة نشطة" : "1 active invoice")).toBeVisible();
  });
}
