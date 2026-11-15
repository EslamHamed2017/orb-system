import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customer and supplier invoice print actions isolate attributed line output`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", { configurable: true, value: () => {
        document.documentElement.dataset.printInvoked = "true";
      } });
    });

    await page.goto(`/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201&locale=${locale}`);
    const customerLabel = locale === "ar" ? "طباعة فاتورة العميل" : "Print customer invoice";
    const salesInvoice = page.locator("#sales-invoice-R1-CINV-001-print");
    const unavailable = page.getByRole("status").filter({ hasText: locale === "ar" ? "لم يتم عرض أي سجلات تجريبية" : "no sample records are shown" });
    await expect(salesInvoice.or(unavailable)).toBeVisible();
    if (await unavailable.isVisible()) {
      await expect(unavailable).toBeVisible();
      await expect(page.getByRole("button", { name: customerLabel })).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: customerLabel }).click();
      await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
      await expect(salesInvoice).toHaveClass(/orb-print-selected/);
      await expect(salesInvoice).toContainText("R1-CINV-001");
      await expect(salesInvoice).toContainText(locale === "ar" ? "عميل الإصدار التجريبي" : "R1 Customer");
      await expect(salesInvoice).toContainText("ORB-R1-SAL-100MT");
      await page.emulateMedia({ media: "print" });
      await expect(page.getByRole("button", { name: customerLabel })).toBeHidden();
      await expect(salesInvoice).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
    }

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
