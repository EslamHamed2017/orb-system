import { expect, test } from "@playwright/test";

const SAVED_PROJECT = "33333333-3333-7333-8333-333333333333";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} project closure on a database project reads the live API and fits a phone`, async ({ page }) => {
    const ar = locale === "ar";
    await page.route(`**/api/projects/${SAVED_PROJECT}/closure-assessment`, (route) => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, code: "DEPENDENCY_UNAVAILABLE" }) }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${SAVED_PROJECT}/closure?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الإغلاق غير متاح" : "Closure unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: /ask to close|reopen/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("demo closure route remains available", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
