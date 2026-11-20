import { expect, test } from "@playwright/test";

const SAVED_PROJECT = "33333333-3333-7333-8333-333333333333";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} claims on a database project say plainly they are not available yet`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/projects/${SAVED_PROJECT}/claims?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المطالبات" : "Claims" })).toBeVisible();
    await expect(page.locator("body")).toContainText(ar ? "غير متاحة لهذا المشروع بعد" : "not available for this project yet");
    await expect(page.getByRole("link", { name: ar ? "العودة إلى المشروع" : "Back to the project" })).toHaveAttribute("href", `/projects/${SAVED_PROJECT}/overview?locale=${locale}`);
    await expect(page.getByRole("button", { name: /claim/i })).toHaveCount(0);
  });
}

test("browser-only claim links no longer read or write browser storage", async ({ page }) => {
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Claims" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open projects" })).toHaveAttribute("href", "/projects?locale=en");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("orb.user-projects")))).toEqual([]);
});

test("demo claims route remains available", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Simple claims" })).toBeVisible();
  await expect(page.getByText("Sales shipment claims")).toBeVisible();
});
