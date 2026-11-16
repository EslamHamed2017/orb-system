import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} project Accounts filters sales invoices and preserves 360 links`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201&locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "فواتير المبيعات" : "Sales invoices" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("navigation", { name: ar ? "مساحة عمل المشروع" : "Project workspace" })).toBeVisible();
    const unavailable = page.getByRole("status");
    const table = page.getByRole("table");
    if (await unavailable.isVisible()) {
      await expect(unavailable).toContainText(ar ? "لم يتم عرض أي سجلات تجريبية" : "no sample records are shown");
      await expect(table.getByRole("row")).toHaveCount(1);
      await expect(page.getByText(ar ? "0 فاتورة نشطة" : "0 active invoices")).toBeVisible();
    } else {
      await expect(table.getByText("R1-CINV-001")).toBeVisible();
      await expect(table.getByText("R1-CINV-NOT-PRESENT")).toHaveCount(0);
      await expect(table.getByRole("link", { name: "ORB-R1-SAL-100MT" })).toHaveAttribute("href", `/sales-shipments/00000000-0000-7000-8000-000000000232?locale=${locale}`);
      await expect(page.getByText(ar ? "1 فاتورة نشطة" : "1 active invoice")).toBeVisible();
      const printTable = page.getByRole("table", { name: ar ? "بنود الفاتورة وتتبع المصدر" : "Invoice lines and source traceability" });
      await expect(printTable).toContainText("100MT Ethiopian Arabica");
      await expect(printTable).toContainText("ORB-R1-SAL-100MT · 1");
      await expect(printTable).toContainText("USD 850.000000");
    }
    const evidence = `artifacts/ui-review/persisted-sales-invoices/desktop-${locale}.png`;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: evidence, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `artifacts/ui-review/persisted-sales-invoices/mobile-${locale}.png`, fullPage: true });
    if (!(await unavailable.isVisible())) {
      const mobilePrintTable = page.getByRole("table", { name: ar ? "بنود الفاتورة وتتبع المصدر" : "Invoice lines and source traceability" });
      await mobilePrintTable.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/ui-review/persisted-sales-invoices/mobile-detail-${locale}.png` });
    }
  });
}
