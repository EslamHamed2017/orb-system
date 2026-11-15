import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} admin creates and configures a role saved in this browser`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/admin/roles?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الأدوار والصلاحيات" : "Roles and permissions" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "إعداد محلي للتقييم — لا يفرض صلاحيات النظام" : "Local evaluation setup — not enforced access")).toBeVisible();
    await page.getByLabel(ar ? "رمز الدور" : "Role code").fill("CONTRACT_REVIEWER");
    await page.getByLabel(ar ? "الاسم بالإنجليزية" : "English name").fill("Contract reviewer");
    await page.getByLabel(ar ? "الاسم بالعربية" : "Arabic name").fill("مراجع العقود");
    await page.getByLabel(ar ? "الوصف بالإنجليزية" : "English description").fill("Reviews contract changes");
    await page.getByLabel(ar ? "الوصف بالعربية" : "Arabic description").fill("يراجع تغييرات العقود");
    await page.getByRole("button", { name: ar ? "حفظ الدور" : "Save role" }).click();
    await page.getByRole("checkbox", { name: ar ? /اعتماد العقود/ : /Approve contracts/ }).check();
    await page.getByRole("button", { name: ar ? "حفظ صلاحيات هذا الدور" : "Save this role’s permissions" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: /CONTRACT_REVIEWER/ })).toContainText(ar ? "صلاحية واحدة" : "1 permission");
    await expect(page.getByRole("checkbox", { name: ar ? /اعتماد العقود/ : /Approve contracts/ })).toBeChecked();
  });
}

test("role administration is read-only without owner administration access", async ({ page }) => {
  await page.goto("/admin/roles?locale=en&role=operations");
  await expect(page.getByText("View only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save role" })).toHaveCount(0);
});

test("malformed saved roles fail safely without showing an editable form", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("orb:evaluation:roles:v1", "not-json"));
  await page.goto("/admin/roles?locale=en");
  await expect(page.getByText("Saved roles could not be read", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save role" })).toHaveCount(0);
});

test("concurrent tabs preserve both newly created roles", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto("/admin/roles?locale=en"), second.goto("/admin/roles?locale=en")]);
  const prepare = async (page: typeof first, code: string) => {
    await page.getByLabel("Role code").fill(code);
    await page.getByLabel("English name").fill(`${code} English`);
    await page.getByLabel("Arabic name").fill(`${code} عربي`);
    await page.getByLabel("English description").fill(`Purpose for ${code}`);
    await page.getByLabel("Arabic description").fill(`غرض ${code}`);
  };
  await Promise.all([prepare(first, "ROLE_ALPHA"), prepare(second, "ROLE_BETA")]);
  await Promise.all([
    first.getByRole("button", { name: "Save role" }).click(),
    second.getByRole("button", { name: "Save role" }).click(),
  ]);
  await first.reload();
  await expect(first.getByRole("button", { name: /ROLE_ALPHA/ })).toBeVisible();
  await expect(first.getByRole("button", { name: /ROLE_BETA/ })).toBeVisible();
  await context.close();
});

test("switching roles cannot silently discard unsaved permission changes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("orb:evaluation:roles:v1", JSON.stringify([
    { id: "alpha", code: "ROLE_ALPHA", nameEn: "Alpha", nameAr: "ألفا", descriptionEn: "Alpha work", descriptionAr: "عمل ألفا", permissionCodes: [], updatedAt: "2026-11-15T03:00:00.000Z" },
    { id: "beta", code: "ROLE_BETA", nameEn: "Beta", nameAr: "بيتا", descriptionEn: "Beta work", descriptionAr: "عمل بيتا", permissionCodes: [], updatedAt: "2026-11-15T03:00:00.000Z" },
  ])));
  await page.goto("/admin/roles?locale=en");
  await page.getByRole("checkbox", { name: /Approve contracts/ }).check();
  await page.getByRole("button", { name: /ROLE_BETA/ }).click();
  await expect(page.getByText("Save or discard permission changes before switching roles.")).toBeVisible();
  await expect(page.getByRole("button", { name: /ROLE_ALPHA/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("button", { name: /ROLE_BETA/ }).click();
  await expect(page.getByRole("button", { name: /ROLE_BETA/ })).toHaveAttribute("aria-pressed", "true");
});
