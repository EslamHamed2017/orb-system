import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} suppliers directory opens a bilingual supplier 360 detail`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/suppliers?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الموردون" : "Suppliers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 2, name: ar ? "دليل الموردين" : "Supplier directory" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("link", { name: ar ? "إضافة مورد" : "Add supplier" })).toHaveAttribute("data-operation-id", "createSupplier");
    await page.getByRole("table").getByRole("link", { name: ar ? "عرض" : "View" }).first().click();
    await expect.poll(() => { const url = new URL(page.url()); return url.pathname + url.search; }).toBe(`/suppliers/supplier-cedar?locale=${locale}`);
    await expect(page.getByText(ar ? "نظرة المورد ٣٦٠°" : "Supplier 360", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: ar ? "السجلات المرتبطة" : "Related records" })).toBeVisible();
    await expect(page.getByRole("link", { name: ar ? "فواتير الموردين" : "Supplier invoices" })).toHaveAttribute("href", /supplierId=supplier-cedar/);
    await expect(page.getByRole("link", { name: ar ? "تعديل المورد" : "Edit supplier" })).toHaveAttribute("data-operation-id", "updateSupplier");
  });
}

test("supplier directory filters by lifecycle and bilingual-searchable data", async ({ page }) => {
  await page.goto("/masters/suppliers?locale=en&status=INACTIVE&q=Savanna");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByText("SUP-2025-014", { exact: false })).toBeVisible();
  await expect(page.getByText("SUP-2026-001", { exact: false })).toHaveCount(0);
});
