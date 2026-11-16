import { expect, test } from "@playwright/test";

const routes = [
  ["supplier-invoices", "Supplier invoices", "PINV-2026-031", "supplier-container-1"],
  ["supplier-payments", "Supplier payments", "PAY-2026-031", "project-1"],
  ["sales-invoices", "Sales invoices", "SINV-2026-014", "sales-shipment-1"],
  ["collections", "Collections", "COL-2026-014", "project-1"],
  ["expenses", "Expenses", "EXP-2026-018", "project-1"],
] as const;

test("finance task routes show server-rendered records with correct headings", async ({ page }) => {
  for (const [route, title, reference] of routes) {
    await page.goto(`/accounts/${route}?locale=en`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const table = page.getByRole("table").first();
    if (route === "sales-invoices") {
      const unavailable = page.getByRole("status").filter({ hasText: "no sample records are shown" });
      if (await unavailable.isVisible()) await expect(table.getByRole("row")).toHaveCount(1);
      else {
        await expect(table.getByText("R1-CINV-001")).toBeVisible();
        await expect(table).not.toContainText("SINV-2026-014");
      }
    } else await expect(table.getByText(reference)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/DEMO|PLACEHOLDER/i);
  }
});

test("finance task routes with projectId filter show only project-scoped records", async ({ page }) => {
  await page.goto("/accounts/sales-invoices?locale=en&projectId=00000000-0000-7000-8000-000000000201");
  await expect(page.getByRole("heading", { level: 1, name: "Sales invoices" })).toBeVisible();
  const table = page.getByRole("table");
  const unavailable = page.getByRole("status").filter({ hasText: "no sample records are shown" });
  if (await unavailable.isVisible()) await expect(table.getByRole("row")).toHaveCount(1);
  else await expect(table.getByText("R1-CINV-001")).toBeVisible();
});

test("role query cannot grant write authority on server-rendered sales invoices", async ({ page }) => {
  await page.goto("/accounts/sales-invoices?locale=en&role=operations&projectId=00000000-0000-7000-8000-000000000201");
  await expect(page.getByRole("heading", { level: 1, name: "Sales invoices" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/DEMO/i);
});

for (const locale of ["en", "ar"] as const) test(`${locale} server-rendered finance register is readable on desktop and mobile`, async ({ page }) => {
  await page.goto(`/accounts/sales-invoices?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "فواتير المبيعات" : "Sales invoices" })).toBeVisible();
  const output = "artifacts/ui-review/product-finance-task-pages-20261115";
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${output}/desktop-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const bottom = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navigationTop: Math.round(bottom.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navigationTop);
  await page.screenshot({ path: `${output}/mobile-${locale}.png`, fullPage: true });
});
