import { expect, test, type Page } from "@playwright/test";

const deferred = /bank import|bank match|tax pack|historical migration|multiple sources|shared expense|approval designer|route designer|claim settlement/i;

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
  await page.goto("/?locale=en");
}

test("desktop uses a persistent rail and top app bar without deferred navigation", async ({ page }) => {
  await open(page, 1440);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator('[data-navigation="rail"]')).toBeVisible();
  await expect(page.locator('[data-navigation="bottom"]')).toBeHidden();
  await expect(page.getByRole("navigation")).not.toContainText(deferred);
  const hrefs = await page.getByRole("navigation").locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.join(" ")).not.toMatch(/bank|tax|migration|source-allocation|expense-allocation|approval-(?:rule|designer)|route-(?:template|designer)|claim-settlement/i);
});

test("tablet uses a compact rail", async ({ page }) => {
  await open(page, 768);
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail).toBeVisible();
  await expect(rail).toHaveAttribute("data-variant", "compact");
  await expect(page.locator('[data-navigation="bottom"]')).toBeHidden();
});

test("narrow screens use Home, Sales, Expenses, Projects and More bottom navigation", async ({ page }) => {
  await open(page, 390);
  await expect(page.locator('[data-navigation="rail"]')).toBeHidden();
  const bottom = page.locator('[data-navigation="bottom"]');
  await expect(bottom).toBeVisible();
  for (const name of [/home/i, /sales/i, /expenses/i, /projects/i, /more/i]) {
    const item = bottom.getByRole("link", { name }).or(bottom.getByRole("button", { name }));
    await expect(item).toBeVisible();
  }
  await expect(bottom).not.toContainText(deferred);
});

test("loading, empty, error, permission, offline and stale states expose a next action", async ({ page }) => {
  await open(page, 390);
  for (const state of ["loading", "empty", "error", "permission-denied", "offline", "stale-version"]) {
    await page.goto(`/?locale=en&demoState=${state}`);
    const region = page.locator(`[data-async-state="${state}"]`);
    await expect(region).toBeVisible();
    if (state !== "loading") await expect(region.getByRole("link").or(region.getByRole("button"))).toBeVisible();
  }
});
