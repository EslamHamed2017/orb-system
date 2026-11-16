import { expect, test, type Page } from "@playwright/test";

async function createActiveProject(page: Page, locale: "en" | "ar" = "en"): Promise<string> {
  await page.goto(`/projects/new?locale=${locale}`);
  const data = {
    customer: "Atlas Foods",
    reference: "AF-101",
    contractReference: "SC-44",
    startDate: "2026-11-14",
    commodity: locale === "ar" ? "بن" : "Coffee",
    quantity: "20",
    unit: "MT",
    currency: "USD",
    unitPrice: "4200",
    origin: locale === "ar" ? "مومباسا" : "Mombasa",
    destination: locale === "ar" ? "دبي" : "Dubai",
  };
  for (const [name, value] of Object.entries(data)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: locale === "ar" ? "حفظ وفتح المشروع" : "Save and open project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/overview/);
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("button", { name: locale === "ar" ? "إكمال إعداد المشروع" : "Complete project setup" }).click();
  await page.locator('[name="supplier"]').fill(locale === "ar" ? "مورد الساحل" : "Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: locale === "ar" ? "حفظ الإعداد" : "Save setup" }).click();
  return id;
}

test("accounts hub exposes operational summary with currency sections and account destinations", async ({ page }) => {
  await page.goto("/accounts?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Accounts hub" })).toBeVisible();
  const unavailable = page.getByRole("status").filter({ hasText: "no sample records are shown" });
  const sections = page.getByRole("navigation", { name: "Available persisted accounts sections" });
  await expect(sections.getByRole("link")).toHaveCount(1);
  if (await unavailable.isVisible()) {
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByLabel("Persisted sales invoice activity by currency")).toHaveCount(0);
  } else {
    await expect(page.getByLabel("Persisted sales invoice activity by currency").getByRole("heading", { level: 2, name: "USD" })).toBeVisible();
    await expect(page.getByRole("table").getByText("R1-CINV-001")).toBeVisible();
    await expect(page.getByRole("table")).not.toContainText(/PINV-2026-044|PAY-2026-044|COL-2026-014/);
  }
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);
});

test("accounts hub does not show raw status strings or placeholder amounts", async ({ page }) => {
  await page.goto("/accounts?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Accounts hub" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|EXTERNAL_SEND|OUTBOUND_MANIFEST/);
});

for (const locale of ["en", "ar"] as const) test(`${locale} accounts hub is readable at desktop and mobile widths`, async ({ page }) => {
  await page.goto(`/accounts?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "مركز الحسابات" : "Accounts hub" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);
  const output = "artifacts/product-finance-daily-hub-20261115";
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${output}/desktop-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
  await page.screenshot({ path: `${output}/mobile-${locale}.png`, fullPage: true });
});
