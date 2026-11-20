import { expect, test } from "@playwright/test";

const SAVED_PROJECT = "33333333-3333-7333-8333-333333333333";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} claims on a database project read the live API and say so when it is down`, async ({ page }) => {
    const ar = locale === "ar";
    await page.route(`**/api/projects/${SAVED_PROJECT}/claims`, (route) => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, code: "DEPENDENCY_UNAVAILABLE" }) }));
    await page.goto(`/projects/${SAVED_PROJECT}/claims?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المطالبات غير متاحة" : "Claims unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: ar ? "حاول مرة أخرى" : "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: /open a claim/i })).toHaveCount(0);
  });
}

test("browser-only claim links no longer read or write browser storage", async ({ page }) => {
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Project not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open projects" })).toHaveAttribute("href", "/projects?locale=en");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("orb.user-projects")))).toEqual([]);
});

test("the old demo claims link shows that the project does not exist", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Project not found" })).toBeVisible();
});
