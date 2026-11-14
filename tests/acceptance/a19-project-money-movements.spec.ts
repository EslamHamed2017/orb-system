import { expect, test } from "@playwright/test";

const views = [
  { path: "collections", title: { en: "Collections", ar: "التحصيلات" }, reference: "COL-2026-014", excluded: "COL-2026-009", party: "customer-1", partyPath: "customers" },
  { path: "supplier-payments", title: { en: "Supplier payments", ar: "دفعات الموردين" }, reference: "PAY-2026-031", excluded: "PAY-2026-044", party: "supplier-1", partyPath: "suppliers" },
] as const;

for (const locale of ["en", "ar"] as const) {
  for (const view of views) {
    test(`${locale} project Accounts filters ${view.path} and preserves party attribution`, async ({ page }) => {
      const ar = locale === "ar";
      await page.goto(`/accounts/${view.path}?projectId=project-1&locale=${locale}`);
      await expect(page.getByRole("heading", { level: 1, name: view.title[locale] })).toBeVisible();
      await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
      await expect(page.getByRole("navigation", { name: ar ? "مساحة عمل المشروع" : "Project workspace" })).toBeVisible();
      const table = page.getByRole("table");
      await expect(table.getByText(view.reference)).toBeVisible();
      await expect(table.getByText(view.excluded)).toHaveCount(0);
      await expect(table.getByRole("link", { name: view.party })).toHaveAttribute("href", `/${view.partyPath}/${view.party}?locale=${locale}`);
      await expect(page.getByText(ar ? "1 حركة نشطة" : "1 active movement")).toBeVisible();
    });
  }
}
