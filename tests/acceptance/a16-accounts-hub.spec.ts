import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} global Accounts hub exposes operational records and typed destinations`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "مركز الحسابات" : "Accounts hub" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByLabel(ar ? "ملخص الحسابات حسب العملة" : "Accounts summary by currency").getByRole("heading", { level: 2 })).toHaveCount(2);
    const sections = page.getByRole("navigation", { name: ar ? "أقسام الحسابات" : "Accounts sections" });
    await expect(sections.getByRole("link")).toHaveCount(5);
    await expect(sections.getByRole("link", { name: ar ? /فواتير الموردين/ : /Supplier invoices/ })).toHaveAttribute("href", `/accounts/supplier-invoices?locale=${locale}`);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(5);
    await expect(page.getByRole("navigation", { name: ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name: ar ? "الحسابات" : "Accounts" })).toHaveAttribute("aria-current", "page");
  });
}
