import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} roles page shows the three server-enforced roles and their operations`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/admin/roles?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الأدوار والصلاحيات" : "Roles and permissions" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    const cards = page.locator(".role-card");
    await expect(cards).toHaveCount(3);
    for (const name of ar ? ["المالك / مدير النظام", "العمليات", "المالية"] : ["Owner administrator", "Operations", "Finance"]) {
      await expect(cards.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: ar ? "المستخدمون والوصول" : "Users and access" })).toHaveAttribute("href", `/admin/users?locale=${locale}`);
  });
}

test("roles page has no browser-stored role editor", async ({ page }) => {
  await page.goto("/admin/roles?locale=en");
  await expect(page.getByRole("button", { name: "Save role" })).toHaveCount(0);
  await expect(page.getByLabel("Role code")).toHaveCount(0);
  const storedKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => /role/i.test(key)));
  expect(storedKeys).toEqual([]);
});

test("operation search narrows the permission matrix", async ({ page }) => {
  await page.goto("/admin/roles?locale=en&q=createUser");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator("code")).toHaveText("createUser");
  await expect(rows.first().locator("td.mark").first()).toHaveText("✓");
  await expect(rows.first().locator("td.mark").nth(1)).toHaveText("—");
});
