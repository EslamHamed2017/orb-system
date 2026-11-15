import { expect, test, type Page } from "@playwright/test";

const supplier = { reference: "SUP-101", nameEn: "Cedar Coffee Export", nameAr: "سيدار لتصدير القهوة", country: "AE", contact: "Hana Bekele", email: "hana@example.com", phone: "+971500001234" };

async function register(page: Page, locale: "en" | "ar") {
  const ar = locale === "ar";
  await page.getByRole("button", { name: ar ? "إضافة مورد" : "Add supplier" }).click();
  await page.getByLabel(ar ? "المرجع" : "Reference").fill(supplier.reference);
  await page.getByLabel(ar ? "الاسم القانوني بالإنجليزية" : "English legal name").fill(supplier.nameEn);
  await page.getByLabel(ar ? "الاسم القانوني بالعربية" : "Arabic legal name").fill(supplier.nameAr);
  await page.getByLabel(ar ? "رمز الدولة" : "Country code").fill(supplier.country);
  await page.getByLabel(ar ? "جهة الاتصال" : "Contact name").fill(supplier.contact);
  await page.getByLabel(ar ? "البريد الإلكتروني" : "Email").fill(supplier.email);
  await page.getByLabel(ar ? "الهاتف" : "Phone").fill(supplier.phone);
  await page.getByRole("button", { name: ar ? "حفظ المورد" : "Save supplier" }).click();
}

for (const locale of ["en", "ar"] as const) test(`${locale} supplier registration persists exact entered data`, async ({ page }) => {
  const ar = locale === "ar";
  await page.goto(`/masters/suppliers?locale=${locale}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: ar ? "لم يُسجل أي مورد بعد" : "No suppliers registered yet" })).toBeVisible();
  await expect(page.getByText(ar ? "محفوظ في هذا المتصفح" : "Saved in this browser")).toBeVisible();
  await register(page, locale);
  await expect(page.getByRole("status")).toContainText(ar ? "تم حفظ المورد" : "Supplier saved");
  await expect(page.getByRole("table")).toContainText(supplier.nameEn);
  await expect(page.getByRole("table")).toContainText(supplier.nameAr);
  await page.reload();
  await expect(page.getByRole("table")).toContainText(supplier.reference);
});

for (const locale of ["en", "ar"] as const) test(`mobile ${locale} supplier registration stays above navigation without overflow`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/masters/suppliers?locale=${locale}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await register(page, locale);
  await expect(page.getByRole("status")).toContainText(locale === "ar" ? "تم حفظ المورد" : "Supplier saved");
  await expect(page.getByRole("table")).toContainText(supplier.contact);
  await expect(page.getByRole("table")).toContainText(supplier.email);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
});

test("corrupt supplier storage shows an error and never substitutes fixtures", async ({ page }) => {
  await page.goto("/masters/suppliers?locale=en");
  await page.evaluate(() => localStorage.setItem("orb.browser-suppliers.v1", "not-json"));
  await page.reload();
  await expect(page.getByText("Saved supplier data could not be read", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Cedar Coffee Exporters");
});


test("saved supplier can be corrected, archived, and reactivated without deletion", async ({ page }) => {
  await page.goto("/masters/suppliers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload();
  await register(page, "en");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Reference")).toHaveAttribute("readonly", "");
  await page.getByLabel("Contact name").fill("Mona Bekele");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("table")).toContainText("Mona Bekele");
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("table")).toContainText("Archived");
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("table")).toContainText("Active");
});

test("supplier directory refreshes when another tab saves a supplier", async ({ context, page }) => {
  const other = await context.newPage();
  await page.goto("/masters/suppliers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload();
  await other.goto("/masters/suppliers?locale=en");
  await register(other, "en");
  await expect(page.getByRole("table")).toContainText(supplier.reference);
  await other.close();
});
