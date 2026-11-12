import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const routes = [
  "/sign-in",
  "/",
  "/projects",
  "/projects/new",
  "/projects/demo/overview",
  "/projects/demo/contracts",
  "/projects/demo/shipments",
  "/sales-shipments/demo",
  "/supplier-shipments/demo",
  "/projects/demo/money",
  "/projects/demo/expenses",
  "/projects/demo/statements",
  "/projects/demo/profit",
  "/projects/demo/claims",
  "/projects/demo/closure",
  "/projects/demo/audit",
  "/masters/products",
  "/masters/customers",
  "/masters/suppliers",
  "/customers/customer-northstar",
  "/suppliers/supplier-andes",
  "/products/product-colombia/movements",
  "/accounts",
  "/accounts/sales-invoices",
  "/accounts/supplier-invoices",
  "/accounts/collections",
  "/accounts/supplier-payments",
  "/accounts/expenses",
  "/attachments",
  "/approvals",
  "/documents/demo",
  "/evidence/demo",
  "/reports",
  "/reports/product-movement",
  "/reports/contract-fulfillment",
  "/reports/accounts",
  "/reports/project-profitability",
  "/settings",
  "/admin/users",
  "/admin/roles",
  "/admin/backup",
] as const;

for (const locale of ["en", "ar"] as const) {
  test(`${locale} pilot surfaces have correct direction, 320px reflow and isolated operational references`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const report: Record<string, unknown> = {};

    for (const route of routes) {
      await page.goto(`${route}?locale=${locale}`);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clipped: [...document.querySelectorAll("main *")]
          .filter((node) => {
            const element = node as HTMLElement;
            const style = getComputedStyle(element);
            return element.children.length === 0
              && element.scrollWidth > element.clientWidth + 1
              && style.overflowX === "visible";
          })
          .slice(0, 5)
          .map((node) => (node as HTMLElement).innerText),
      }));
      report[route] = state;
      expect(state.overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(state.clipped, `${route} clipped leaf text`).toEqual([]);

      const references = page.locator("[data-orb-reference]");
      for (let index = 0; index < await references.count(); index += 1) {
        await expect(references.nth(index)).toHaveCSS("unicode-bidi", /isolate|isolate-override/);
      }
    }

    await testInfo.attach(`bidi-reflow-${locale}.json`, {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: "application/json",
    });
  });
}
