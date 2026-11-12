import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} project Accounts filters expenses and preserves transaction scope`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts/expenses?projectId=project-1&locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المصروفات" : "Expenses" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("navigation", { name: ar ? "سجلات المشروع المرتبطة" : "Related project records" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText("EXP-2026-018")).toBeVisible();
    await expect(table.getByText("EXP-2026-022")).toHaveCount(0);
    await expect(table.getByRole("link", { name: "sales-shipment-1" })).toHaveAttribute("href", `/sales-shipments/sales-shipment-1?locale=${locale}`);
    await expect(table.getByText("USD 1250.000000")).toBeVisible();
    await expect(page.getByText(ar ? "1 مصروف نشط" : "1 active expense")).toBeVisible();
  });
}
