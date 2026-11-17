import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product movement report truthfully shows no approved movement data`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/reports/product-movement?locale=${locale}&role=finance&projectId=project-orion&direction=OUTBOUND&from=2026-11-01&to=2026-11-30`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "تقرير حركة المنتج" : "Product movement report" })).toBeVisible();
    await expect(page.getByRole("form", { name: ar ? "مرشحات تقرير حركة المنتج" : "Product movement report filters" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: ar ? "تتبع الحركة" : "Movement traceability" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(ar ? "لا توجد حركات معتمدة مطابقة." : "No matching approved movements.");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("PROD-001", { exact: true })).toHaveCount(0);
    await expect(page.getByText("SSH-2026-0042", { exact: true })).toHaveCount(0);
    await expect(page.getByText("SCN-2026-0081", { exact: true })).toHaveCount(0);
  });
}
