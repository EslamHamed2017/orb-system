import { expect, test } from "@playwright/test";

test("operations navigation hides finance and administration while preserving role context", async ({ page }) => {
  await page.goto("/projects/demo/contracts?locale=en&role=operations");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects?locale=en&role=operations");
  await expect(rail.getByRole("link", { name: "Shipments" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Accounts" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add purchase contract" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Submit for approval" }).first()).toBeEnabled();
});

test("finance navigation exposes operational accounts but not trade mutation or administration", async ({ page }) => {
  await page.goto("/accounts?locale=ar&role=finance");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "الحسابات" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "التقارير" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "المنتجات" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "الإدارة" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("unknown role fails closed to Today and denied actions", async ({ page }) => {
  await page.goto("/projects/demo/contracts?locale=en&role=unexpected-role");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Projects" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add purchase contract" })).toBeDisabled();
});
