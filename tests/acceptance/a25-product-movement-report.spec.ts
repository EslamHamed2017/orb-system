import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement report filters and links traceability`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/reports/product-movement?locale=${locale}&role=finance&projectId=project-orion&direction=OUTBOUND&from=2026-11-01&to=2026-11-30`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "تقرير حركة المنتج" : "Product movement report" })).toBeVisible();
    await expect(page.getByRole("form", { name: ar ? "مرشحات تقرير حركة المنتج" : "Product movement report filters" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: ar ? "تتبع الحركة" : "Movement traceability" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PROD-001" })).toHaveAttribute("href", `/products/product-1/movements?locale=${locale}&role=finance`);
    await expect(page.getByRole("link", { name: "SSH-2026-0042" })).toHaveAttribute("href", `/sales-shipments/shipment-42?locale=${locale}&role=finance&projectId=project-orion`);
    await expect(page.getByText("SCN-2026-0081")).toHaveCount(0);
  });
}
