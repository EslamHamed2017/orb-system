import { expect, test, type Page } from "@playwright/test";

const expectedReleaseCommit = process.env.ORB_EXPECTED_RELEASE_COMMIT;
const configuredTarget = process.env.ORB_TEST_BASE_URL;
if (!configuredTarget) throw new Error("ORB_TEST_BASE_URL is required for owner UAT");
const expectedTargetOrigin = new URL(configuredTarget).origin;

async function gotoApprovedTarget(page: Page, path: string) {
  await page.goto(path);
  expect(new URL(page.url()).origin, `navigation escaped approved UAT origin at ${path}`).toBe(expectedTargetOrigin);
}

const locales = [
  { locale: "en", direction: "ltr" },
  { locale: "ar", direction: "rtl" },
] as const;

for (const { locale, direction } of locales) {
  test(`owner UAT technical journey exposes the P0 lifecycle in ${locale}`, async ({ page, request }) => {
    const readiness = await request.get("/api/health/ready");
    expect(readiness.status()).toBe(200);
    expect(new URL(readiness.url()).origin, "readiness escaped approved UAT origin").toBe(expectedTargetOrigin);
    const readinessBody = await readiness.json();
    expect(readinessBody).toMatchObject({ status: "ready" });
    if (expectedReleaseCommit) expect(readinessBody.release?.gitCommit).toBe(expectedReleaseCommit);

    const routes = [
      "/masters/customers", "/masters/suppliers", "/masters/products", "/projects/demo/overview",
      "/projects/demo/contracts", "/supplier-shipments/demo", "/sales-shipments/demo",
      "/accounts/sales-invoices?projectId=project-1", "/accounts/supplier-invoices?projectId=project-1",
      "/accounts/collections?projectId=project-1", "/accounts/supplier-payments?projectId=project-1",
      "/accounts/expenses?projectId=project-1", "/attachments", "/reports/product-movement",
      "/projects/demo/closure",
    ] as const;
    for (const route of routes) {
      await gotoApprovedTarget(page, `${route}${route.includes("?") ? "&" : "?"}locale=${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      await expect(page.locator("main").first(), route).toBeVisible();
      await expect(page.locator("body"), route).not.toContainText(/application error|internal server error/i);
    }

    await gotoApprovedTarget(page, `/supplier-shipments/demo?locale=${locale}`);
    await expect(page.getByText(/2 suppliers|supplier count|موردان|عدد الموردين/i).first()).toBeVisible();
    await expect(page.getByText(/separate supplier invoice|فاتورة مورد مستقلة/i).first()).toBeVisible();

    await gotoApprovedTarget(page, `/sales-shipments/demo?locale=${locale}&state=confirmed`);
    await expect(page.getByRole("progressbar")).toHaveCount(2);

    await gotoApprovedTarget(page, `/accounts/sales-invoices?projectId=project-1&locale=${locale}`);
    await expect(page.getByText(/sales shipment|شحنة بيع/i).first()).toBeVisible();

    await gotoApprovedTarget(page, `/accounts/supplier-invoices?projectId=project-1&locale=${locale}`);
    await expect(page.getByText(/supplier|مورد/i).first()).toBeVisible();
    await expect(page.getByText(/container|حاوية/i).first()).toBeVisible();

    await gotoApprovedTarget(page, `/reports/product-movement?locale=${locale}`);
    await expect(page.locator("body")).toContainText(/not a stock balance or inventory valuation|ليس رصيد مخزون|لا تتضمن تقييم المخزون/i);
  });
}
