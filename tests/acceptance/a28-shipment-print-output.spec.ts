import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} shipment and container print actions isolate complete line output`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", { configurable: true, value: () => {
        document.documentElement.dataset.printInvoked = "true";
      } });
    });

    await page.goto(`/projects/demo/shipments?locale=${locale}`);
    const shipmentLabel = locale === "ar" ? "طباعة الشحنة" : "Print shipment";
    const containerLabel = locale === "ar" ? "طباعة الحاوية" : "Print container";
    const shipment = page.locator("#sales-shipment-print");
    const container = page.locator("#supplier-container-print");

    await page.getByRole("button", { name: shipmentLabel }).click();
    await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
    await expect(shipment).toHaveClass(/orb-print-selected/);
    await expect(shipment).toContainText("ORB-SAL-0007");
    await expect(shipment).toContainText("SAL-2026-004 · 1");
    await expect(shipment).toContainText("PO-481");

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: shipmentLabel })).toBeHidden();
    await expect(shipment).toBeVisible();
    await expect(container).toBeHidden();

    await page.emulateMedia({ media: "screen" });
    await page.reload();
    await page.getByRole("button", { name: containerLabel }).click();
    await expect(container).toHaveClass(/orb-print-selected/);
    await expect(container).toContainText("ORB-SUP-0007");
    await expect(container).toContainText("Arbor Export");
    await expect(container).toContainText("Blue Nile Trading");
    await expect(container).toContainText("PUR-2026-011 · 1");
  });
}
