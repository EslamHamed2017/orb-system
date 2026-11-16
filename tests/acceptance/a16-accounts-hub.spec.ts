import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} global Accounts hub exposes operational records and typed destinations`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "مركز الحسابات" : "Accounts hub" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    const sections = page.getByRole("navigation", { name: ar ? "أقسام الحسابات المحفوظة المتاحة" : "Available persisted accounts sections" });
    await expect(sections.getByRole("link")).toHaveCount(1);
    await expect(sections.getByRole("link", { name: ar ? /فواتير المبيعات/ : /Sales invoices/ })).toHaveAttribute("href", `/accounts/sales-invoices?locale=${locale}`);
    const unavailable = page.getByRole("status").filter({ hasText: ar ? "لم يتم عرض أي سجلات تجريبية" : "no sample records are shown" });
    if (await unavailable.isVisible()) await expect(page.getByRole("table")).toHaveCount(0);
    else {
      await expect(page.getByLabel(ar ? "نشاط فواتير المبيعات المحفوظ حسب العملة" : "Persisted sales invoice activity by currency").getByRole("heading", { level: 2, name: "USD" })).toBeVisible();
      await expect(page.getByRole("table").getByText("R1-CINV-001")).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: ar ? "التنقل الرئيسية" : "Primary navigation" }).first().getByRole("link", { name: ar ? "الحسابات" : "Accounts" })).toHaveAttribute("aria-current", "page");
  });
}
