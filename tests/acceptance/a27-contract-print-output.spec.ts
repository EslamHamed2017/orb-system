import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} contract print actions target one complete contract`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", { configurable: true, value: () => {
        document.documentElement.dataset.printInvoked = "true";
      } });
    });
    await page.goto(`/projects/demo/contracts?locale=${locale}`);

    const label = locale === "ar" ? "طباعة العقد" : "Print contract";
    const actions = page.getByRole("button", { name: label });
    await expect(actions).toHaveCount(3);
    await actions.first().click();

    await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
    await expect(page.locator("#sales-contract-print")).toHaveClass(/orb-print-selected/);
    await expect(page.locator("body")).toHaveClass(/orb-printing/);
    await expect(page.locator("#sales-contract-print")).toContainText(locale === "ar" ? "عقد بيع" : "Sales contract");
    await expect(page.locator("#sales-contract-print")).toContainText(locale === "ar" ? "شروط الدفع" : "Payment terms");

    await page.emulateMedia({ media: "print" });
    await expect(actions.first()).toBeHidden();
    await expect(page.locator("#sales-contract-print")).toBeVisible();
    await expect(page.locator("#purchase-contract-PC-0007-print")).toBeHidden();
  });
}
