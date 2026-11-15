import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customers directory exposes a bilingual registration entry`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/customers?locale=${locale}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: ar ? "العملاء" : "Customers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    const addCustomer = page.getByRole("button", { name: ar ? "إضافة عميل" : "Add customer" });
    await expect(addCustomer).toHaveAttribute("data-operation-id", "createCustomer");
    await addCustomer.click();
    await expect(page.locator("#customer-registration")).toHaveAttribute("open", "");
    await expect(page.locator("#customer-registration input[name=reference]")).toBeFocused();
  });

  test(`${locale} retained customer 360 fixture remains available as a labelled evaluation route`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/customers/customer-northstar?locale=${locale}`);
    await expect(page.getByText(ar ? "نظرة العميل ٣٦٠°" : "Customer 360", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: ar ? "السجلات المرتبطة" : "Related records" })).toBeVisible();
    await expect(page.getByRole("link", { name: ar ? "تعديل العميل" : "Edit customer" })).toHaveAttribute("data-operation-id", "updateCustomer");
  });
}

test("customer directory filters persisted bilingual data", async ({ page }) => {
  await page.goto("/masters/customers?locale=en");
  await page.evaluate(() => localStorage.setItem("orb.user-customers.owner-1.v1", JSON.stringify([{ id: "customer-101", reference: "CUS-101", legalNameEn: "Atlas Coffee", legalNameAr: "أطلس للقهوة", countryCode: "AE", contactName: "Noor Ali", email: "noor@example.com", phone: "+971500001234", active: true, projectCount: 0, openInvoiceCount: 0 }])));
  await page.goto("/masters/customers?locale=en&status=ACTIVE&q=Atlas");
  await expect(page.getByRole("table")).toContainText("CUS-101");
  await page.goto("/masters/customers?locale=en&status=INACTIVE&q=Atlas");
  await expect(page.getByRole("heading", { name: "No matching customers" })).toBeVisible();
});
