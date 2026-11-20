import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} A1 pages expose the complete keyboard-accessible journey`, async ({ page }) => {
    await page.route(/\/api\/projects(?:\?.*)?$/, (route) => route.fulfill({ status: 200, headers: { "x-orb-project-write-permitted": "true" }, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) }));
    await page.goto(`/masters/customers?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "العملاء" : "Customers");
    await expect(page.getByRole("button", { name: locale === "ar" ? /إضافة/ : /add customer/i })).toBeVisible();

    await page.goto(`/projects?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "المشاريع" : "Projects");
    await expect(page.getByRole("link", { name: locale === "ar" ? /مشروع جديد/ : /new project/i })).toBeVisible();

    await page.route("**/api/customers", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "11111111-1111-7111-8111-111111111111", reference: "CUS-001", legalName: "Northstar", legalNameAr: "نورث ستار", status: "ACTIVE", version: 1 }], nextCursor: null }) }));
    await page.route("**/api/products", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "22222222-2222-7222-8222-222222222222", reference: "PROD-001", nameEn: "Yemen Matari", nameAr: "مطري يمني", status: "ACTIVE", version: 1 }], nextCursor: null }) }));
    await page.goto(`/projects/new?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "مشروع جديد" : "New project");
    await expect(page.getByLabel(locale === "ar" ? "العميل" : "Customer")).toBeVisible();
    await expect(page.getByLabel(locale === "ar" ? "المنتج" : "Product")).toBeVisible();
    await expect(page.getByLabel(locale === "ar" ? /تحمل النقص في الكمية/ : /quantity under tolerance/i)).toHaveValue("0");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await page.goto(`/projects/demo/contracts?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "المشروع غير موجود" : "Project not found" })).toBeVisible();
  });
}

test("A1 screens never expose destructive or deferred controls", async ({ page }) => {
  for (const path of ["/masters/customers", "/projects", "/projects/new", "/projects/demo/contracts"]) {
    await page.goto(`${path}?locale=en`);
    await expect(page.locator("body")).not.toContainText(/delete|bank import|tax pack|multiple sources|shared expense|designer/i);
  }
});
