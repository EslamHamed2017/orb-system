import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} record pages preserve project context in breadcrumbs and related links`, async ({ page }) => {
    const projectId = "pilot-project";
    await page.goto(`/sales-shipments/sale-9?locale=${locale}&projectId=${projectId}`);
    const breadcrumb = page.getByRole("navigation", { name: locale === "ar" ? "مسار التنقل" : "Breadcrumb" });
    await expect(breadcrumb).toContainText(projectId);
    await expect(breadcrumb).toContainText(locale === "ar" ? "شحنة البيع" : "Sales shipment");
    await expect(breadcrumb).toContainText("sale-9");
    await expect(breadcrumb.getByRole("link", { name: projectId })).toHaveAttribute("href", `/projects/${projectId}/overview?locale=${locale}`);

    const related = page.getByRole("navigation", { name: locale === "ar" ? "مساحة عمل المشروع" : "Project workspace" });
    await expect(related.getByRole("link")).toHaveCount(9);
    await expect(related.getByRole("link", { name: locale === "ar" ? "العقود" : "Contracts" })).toHaveAttribute("href", `/projects/${projectId}/contracts?locale=${locale}`);
    await expect(related.getByRole("link", { name: locale === "ar" ? "حاوية الموردين" : "Supplier container" })).toHaveAttribute("href", `/projects/${projectId}/shipments?locale=${locale}#supplier-dataset`);
    await expect(related.getByRole("link", { name: locale === "ar" ? "الحسابات" : "Accounts" })).toHaveAttribute("href", `/projects/${projectId}/money?locale=${locale}`);
  });
}

test("project overview and independent supplier container navigate both ways", async ({ page }) => {
  await page.goto("/projects/demo/overview?locale=en");
  await expect(page.getByRole("navigation", { name: "Project workspace" }).getByRole("link", { name: "Supplier container" })).toBeVisible();
  await page.goto("/supplier-shipments/container-2?locale=en&projectId=demo");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "demo" })).toHaveAttribute("href", "/projects/demo/overview?locale=en");
  await expect(breadcrumb).toContainText("container-2");
});
