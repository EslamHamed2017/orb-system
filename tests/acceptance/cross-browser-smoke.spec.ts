import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const routes = [
  "/masters/customers",
  "/masters/suppliers",
  "/masters/products",
  "/projects/demo/overview",
  "/projects/demo/contracts",
  "/supplier-shipments/demo",
  "/sales-shipments/demo",
  "/accounts",
  "/attachments",
  "/reports",
] as const;

for (const locale of ["en", "ar"] as const) {
  test(`${locale} daily-use pilot smoke is portable across browser engines`, async ({ page, request }) => {
    const liveness = await request.get("/api/health/live");
    expect(liveness.status()).toBe(200);

    for (const route of routes) {
      const response = await page.goto(`${route}?locale=${locale}`);
      expect(response, route).not.toBeNull();
      expect(response!.status(), route).toBeLessThan(400);
      await expect(page.locator("main").first(), route).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("body"), route).not.toContainText(/application error|internal server error/i);
    }

    await page.goto(`/supplier-shipments/demo?locale=${locale}`);
    await expect(page.locator("main table").first()).toBeVisible();
    await page.goto(`/sales-shipments/demo?locale=${locale}&state=confirmed`);
    await expect(page.getByRole("progressbar")).toHaveCount(2);
  });
}
