import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customers directory opens a bilingual customer 360 detail`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/customers?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "العملاء" : "Customers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 2, name: ar ? "دليل العملاء" : "Customer directory" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    const addCustomer = page.getByRole("button", { name: ar ? "إضافة عميل" : "Add customer" });
    await expect(addCustomer).toHaveAttribute("data-operation-id", "createCustomer");
    await expect(addCustomer).toHaveAttribute("aria-controls", "customer-registration");
    await addCustomer.click();
    await expect(page.locator("#customer-registration")).toHaveAttribute("open", "");
    await expect(page.locator("#customer-registration input[name=reference]")).toBeFocused();
    await page.getByRole("table").getByRole("link", { name: ar ? "عرض" : "View" }).first().click();
    await expect.poll(() => { const url = new URL(page.url()); return url.pathname + url.search; }).toBe(`/customers/customer-northstar?locale=${locale}`);
    await expect(page.getByText(ar ? "نظرة العميل ٣٦٠°" : "Customer 360", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: ar ? "السجلات المرتبطة" : "Related records" })).toBeVisible();
    await expect(page.getByRole("link", { name: ar ? "فواتير المبيعات" : "Sales invoices" })).toHaveAttribute("href", /customerId=customer-northstar/);
    await expect(page.getByRole("link", { name: ar ? "تعديل العميل" : "Edit customer" })).toHaveAttribute("data-operation-id", "updateCustomer");
  });
}

test("customer directory filters by lifecycle and bilingual-searchable data", async ({ page }) => {
  await page.goto("/masters/customers?locale=en&status=INACTIVE&q=Harbor");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByText("CUS-2025-014", { exact: false })).toBeVisible();
  await expect(page.getByText("CUS-2026-001", { exact: false })).toHaveCount(0);
});
