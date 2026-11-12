import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} Reports hub preserves operational filter context`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/reports?locale=${locale}&role=finance&projectId=pilot-project&from=2026-11-01&to=2026-11-30`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "مركز التقارير" : "Reports hub" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: ar ? "التقارير المتاحة" : "Available reports" }).getByRole("link")).toHaveCount(4);
    await expect(page.getByRole("link", { name: new RegExp(ar ? "تنفيذ العقود" : "Contract fulfillment") })).toHaveAttribute("href", "/api/reports/contract-fulfillment?projectId=pilot-project&from=2026-11-01&to=2026-11-30");
    await expect(page.locator('[data-navigation="rail"]').getByRole("link", { name: ar ? "التقارير" : "Reports" })).toHaveAttribute("aria-current", "page");
  });
}
