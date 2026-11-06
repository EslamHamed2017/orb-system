import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} A1 pages expose the complete keyboard-accessible journey`, async ({ page }) => {
    await page.goto(`/masters/customers?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "العملاء" : "Customers");
    await expect(page.getByRole("button", { name: locale === "ar" ? /إضافة/ : /add customer/i })).toBeVisible();

    await page.goto(`/projects?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "المشاريع" : "Projects");
    await expect(page.getByRole("link", { name: locale === "ar" ? /مشروع جديد/ : /new project/i })).toBeVisible();

    await page.goto(`/projects/new?locale=${locale}`);
    await expect(page.getByText(locale === "ar" ? /الخطوة 1 من 3/ : /step 1 of 3/i)).toBeVisible();
    await expect(page.getByLabel(locale === "ar" ? /تحمل الكمية/ : /quantity tolerance/i)).toHaveValue("0");
    await expect(page.getByLabel(locale === "ar" ? /تحمل السعر/ : /price tolerance/i)).toHaveValue("0");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await page.goto(`/projects/demo/contracts?locale=${locale}`);
    await expect(page.getByText(locale === "ar" ? /للقراءة فقط/ : /read-only/i)).toBeVisible();
    await expect(page.getByRole("table", { name: locale === "ar" ? /مقارنة الإصدار/ : /version comparison/i })).toBeVisible();
    await expect(page.getByLabel(locale === "ar" ? /تاريخ السريان/ : /effective date/i)).toBeVisible();
    await expect(page.getByLabel(locale === "ar" ? /سبب التعديل/ : /amendment reason/i)).toBeVisible();
  });
}

test("stale and forbidden responses keep work safe and give an explicit next action", async ({ page }) => {
  await page.goto("/projects/demo/contracts?locale=en&demoState=stale");
  await expect(page.getByRole("alert").filter({ hasText: /newer version/i })).toContainText(/newer version/i);
  await expect(page.getByRole("button", { name: /compare and reload/i })).toBeVisible();
  await page.goto("/projects/demo/contracts?locale=en&demoState=forbidden");
  await expect(page.getByRole("alert").filter({ hasText: /permission/i })).toContainText(/permission/i);
  await expect(page.getByRole("link", { name: /return to projects/i })).toBeVisible();
});

test("A1 screens never expose destructive or deferred controls", async ({ page }) => {
  for (const path of ["/masters/customers", "/projects", "/projects/new", "/projects/demo/contracts"]) {
    await page.goto(`${path}?locale=en`);
    await expect(page.locator("body")).not.toContainText(/delete|bank import|tax pack|multiple sources|shared expense|designer/i);
  }
});
