import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} role matrix exposes granular permission assignments`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/admin/roles?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الأدوار والصلاحيات" : "Roles and permissions" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 2, name: ar ? "مصفوفة الصلاحيات" : "Permission matrix" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: ar ? "الصلاحية" : "Permission" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "OWNER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `${ar ? "اعتماد العقود" : "Approve contracts"} — OWNER_ADMIN` })).toBeChecked();
    await expect(page.getByRole("button", { name: ar ? "حفظ الصلاحيات" : "Save permissions" })).toHaveAttribute("data-operation-id", "replaceRolePermissions");
    await expect(page.getByRole("button", { name: ar ? "إنشاء دور" : "Create role" })).toHaveAttribute("data-operation-id", "createRole");
  });
}

test("role matrix is read-only without owner administration access", async ({ page }) => {
  await page.goto("/admin/roles?locale=en&role=operations");
  await expect(page.getByText("View only", { exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole("checkbox").evaluateAll((items) => items.length > 0 && items.every((item) => (item as HTMLInputElement).disabled))).toBe(true);
  await expect(page.getByRole("button", { name: "Save permissions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create role" })).toHaveCount(0);
});
