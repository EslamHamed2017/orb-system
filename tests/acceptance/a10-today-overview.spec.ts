import { expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, locale: "en" | "ar" = "en"): Promise<string> {
  await page.goto(`/projects/new?locale=${locale}`);
  const data = { customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" };
  for (const [name, value] of Object.entries(data)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: locale === "ar" ? "حفظ وفتح المشروع" : "Save and open project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/overview/);
  return new URL(page.url()).pathname;
}

test("empty Today and Projects disclose browser-only storage and never show fixed projects", async ({ page }) => {
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "No actions yet" })).toBeVisible();
  await expect(page.locator("body")).toContainText("No sample project is inserted into your personal list");
  await page.goto("/projects?locale=en");
  await expect(page.getByRole("heading", { name: "No saved projects" })).toBeVisible();
  await expect(page.locator("body")).toContainText("saved in this browser only");
  await expect(page.locator("body")).not.toContainText(/Pilot Customer|ORB-P-0001/);
});

test("creation persists exact fields, opens the exact detail, and Today has one direct action", async ({ page }) => {
  const detailPath = await createProject(page);
  await expect(page.getByRole("heading", { level: 1, name: "Atlas Foods" })).toBeVisible();
  await expect(page.locator("body")).toContainText("AF-101");
  await expect(page.locator("body")).toContainText("SC-44");
  await expect(page.getByText("Not started", { exact: true })).toHaveCount(7);
  await expect(page.locator('#lifecycle a[href*="/contracts"], #lifecycle a[href*="/shipments"], #lifecycle a[href*="/money"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Pilot Customer|estimated total|actual margin/i);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(detailPath));
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "Review project setup" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open action" })).toHaveAttribute("href", /\/overview\?locale=en#project-data$/);
  await page.goto(`${detailPath}?locale=en`);
  await expect(page.getByRole("button", { name: "Confirm setup and start operations" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review project setup" })).toHaveAttribute("href", /\/overview\?locale=en#project-data$/);
});

test("corrupt browser storage shows an error instead of pretending the register is empty", async ({ page }) => {
  await page.goto("/projects?locale=en");
  await page.evaluate(() => localStorage.setItem("orb.user-projects.owner-1.v1", "not-json"));
  await page.reload();
  await expect(page.getByText("Projects could not be opened", { exact: true })).toBeVisible();
});

test("project search works and cards reflow above mobile navigation", async ({ page }) => {
  await createProject(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects?locale=en");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("Atlas");
  await expect(page.getByRole("heading", { name: "Atlas Foods" })).toBeVisible();
  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const bottom = page.locator('[data-navigation="bottom"]');
  await expect(bottom).toBeVisible();
});

for (const locale of ["en", "ar"] as const) test(`${locale} bounded flow uses route direction and business copy`, async ({ page }) => {
  await createProject(page, locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.locator("body")).toContainText(locale === "ar" ? "مسار دورة العمل" : "Lifecycle tasks");
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|[a-f0-9]{32}/);
});
