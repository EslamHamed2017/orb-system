import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} project Accounts filters supplier invoices and preserves attribution links`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts/supplier-invoices?projectId=project-1&locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "فواتير الموردين" : "Supplier invoices" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("navigation", { name: ar ? "سجلات المشروع المرتبطة" : "Related project records" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText("PINV-2026-031")).toBeVisible();
    await expect(table.getByText("PINV-2026-044")).toHaveCount(0);
    await expect(table.getByRole("link", { name: "supplier-1" })).toHaveAttribute("href", `/suppliers/supplier-1?locale=${locale}`);
    await expect(table.getByRole("link", { name: "supplier-container-1" })).toHaveAttribute("href", `/supplier-shipments/supplier-container-1?locale=${locale}`);
    await expect(page.getByText(ar ? "1 فاتورة نشطة" : "1 active invoice")).toBeVisible();
  });
}
