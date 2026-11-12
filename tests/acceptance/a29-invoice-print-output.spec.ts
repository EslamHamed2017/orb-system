import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customer and supplier invoice print actions isolate attributed line output`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", { configurable: true, value: () => {
        document.documentElement.dataset.printInvoked = "true";
      } });
    });

    await page.goto(`/accounts/sales-invoices?projectId=project-1&locale=${locale}`);
    const customerLabel = locale === "ar" ? "طباعة فاتورة العميل" : "Print customer invoice";
    const salesInvoice = page.locator("#sales-invoice-SINV-2026-014-print");
    await page.getByRole("button", { name: customerLabel }).click();
    await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
    await expect(salesInvoice).toHaveClass(/orb-print-selected/);
    await expect(salesInvoice).toContainText("SINV-2026-014");
    await expect(salesInvoice).toContainText("Northstar Roasters");
    await expect(salesInvoice).toContainText("SAL-2026-004");
    await expect(salesInvoice).toContainText("Ethiopia Guji");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: customerLabel })).toBeHidden();
    await expect(salesInvoice).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeHidden();

    await page.emulateMedia({ media: "screen" });
    await page.goto(`/accounts/supplier-invoices?projectId=project-1&locale=${locale}`);
    const supplierLabel = locale === "ar" ? "طباعة فاتورة المورد" : "Print supplier invoice";
    const supplierInvoice = page.locator("#supplier-invoice-PINV-2026-031-print");
    await page.getByRole("button", { name: supplierLabel }).click();
    await expect(supplierInvoice).toHaveClass(/orb-print-selected/);
    await expect(supplierInvoice).toContainText("PINV-2026-031");
    await expect(supplierInvoice).toContainText("Arbor Export");
    await expect(supplierInvoice).toContainText("ORB-SUP-0007");
    await expect(supplierInvoice).toContainText("PUR-2026-011 · 1");
  });
}
