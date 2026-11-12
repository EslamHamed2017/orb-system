import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} full users management supports bilingual lifecycle administration`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/admin/users?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المستخدمون والوصول" : "Users and access" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 2, name: ar ? "دليل المستخدمين" : "User directory" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("link", { name: ar ? "إضافة مستخدم" : "Add user" })).toHaveAttribute("data-operation-id", "createUser");
    await expect(page.getByRole("link", { name: ar ? "تعديل" : "Edit" }).first()).toHaveAttribute("data-operation-id", "updateUser");
    await expect(page.getByRole("link", { name: ar ? "تعيين الأدوار" : "Assign roles" }).first()).toHaveAttribute("data-operation-id", "assignFixedPilotRoles");
    await page.getByRole("link", { name: ar ? "إضافة مستخدم" : "Add user" }).click();
    await expect(page.getByRole("button", { name: ar ? "حفظ المستخدم" : "Save user" })).toHaveAttribute("data-required-role", "OWNER_ADMIN");
  });
}

test("users directory filters lifecycle and hides protected actions from read-only viewers", async ({ page }) => {
  await page.goto("/admin/users?locale=en&status=SUSPENDED&role=finance-viewer");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByText("finance@orb.test", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add user" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revoke exact session" })).toHaveCount(0);
  await expect(page.getByText("View only", { exact: true })).toBeVisible();
});
