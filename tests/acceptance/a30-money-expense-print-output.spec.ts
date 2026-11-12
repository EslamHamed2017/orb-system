import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} collection, supplier payment, and expense print actions isolate attributed output`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", { configurable: true, value: () => {
        document.documentElement.dataset.printInvoked = "true";
      } });
    });

    const cases = [
      { path: "collections", label: locale === "ar" ? "طباعة التحصيل" : "Print collection", id: "#collection-COL-2026-014-print", expected: ["COL-2026-014", "customer-1", "USD 20000.000000"] },
      { path: "supplier-payments", label: locale === "ar" ? "طباعة دفعة المورد" : "Print supplier payment", id: "#supplierPayment-PAY-2026-031-print", expected: ["PAY-2026-031", "supplier-1", "USD 12500.000000"] },
      { path: "expenses", label: locale === "ar" ? "طباعة المصروف" : "Print expense", id: "#expense-EXP-2026-018-print", expected: ["EXP-2026-018", "sales-shipment-1", "USD 1250.000000"] },
    ] as const;

    for (const item of cases) {
      await page.goto(`/accounts/${item.path}?projectId=project-1&locale=${locale}`);
      const document = page.locator(item.id);
      await page.getByRole("button", { name: item.label }).click();
      await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
      await expect(document).toHaveClass(/orb-print-selected/);
      for (const value of item.expected) await expect(document).toContainText(value);
      await page.emulateMedia({ media: "print" });
      await expect(page.getByRole("button", { name: item.label })).toBeHidden();
      await expect(document).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
      await page.emulateMedia({ media: "screen" });
    }
  });
}
