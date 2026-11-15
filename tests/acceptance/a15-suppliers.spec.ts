import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} supplier directory is honest and fixture-free`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/suppliers?locale=${locale}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الموردون" : "Suppliers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "محفوظ في هذا المتصفح" : "Saved in this browser")).toBeVisible();
    await expect(page.getByRole("heading", { name: ar ? "لم يُسجل أي مورد بعد" : "No suppliers registered yet" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Cedar Coffee Exporters");
    await expect(page.locator("body")).not.toContainText(ar ? "المشاريع المرتبطة" : "Linked projects");
    await expect(page.locator("body")).not.toContainText(ar ? "فواتير مفتوحة" : "Open invoices");
  });
}

test("legacy supplier 360 evaluation route remains directly reviewable but separate", async ({ page }) => {
  await page.goto("/suppliers/supplier-cedar?locale=en");
  await expect(page.getByText("Supplier 360", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Related records" })).toBeVisible();
});


test("supplier filters preserve role and every lifecycle mutation remains permission-aware", async ({ page }) => {
  const record = [{ id: "supplier-permission", reference: "SUP-900", legalNameEn: "Permission Supplier", legalNameAr: "مورد الصلاحيات", countryCode: "ET", contactName: "Hana", email: "hana@example.com", phone: "+251 900", active: true, projectCount: 0, openInvoiceCount: 0 }];
  await page.goto("/masters/suppliers?locale=en&role=finance");
  await page.evaluate((items) => localStorage.setItem("orb.browser-suppliers.v1", JSON.stringify(items)), record);
  await page.reload();
  await expect(page.getByRole("button", { name: "Add supplier" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Edit" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Archive" })).toBeDisabled();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/role=finance/);
  await expect(page.getByRole("button", { name: "Add supplier" })).toBeDisabled();
});
