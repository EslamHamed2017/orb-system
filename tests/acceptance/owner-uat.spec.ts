import { expect, test, type Page } from "@playwright/test";

const expectedReleaseCommit = process.env.ORB_EXPECTED_RELEASE_COMMIT;
if (!expectedReleaseCommit) throw new Error("ORB_EXPECTED_RELEASE_COMMIT is required for owner UAT");
const configuredTarget = process.env.ORB_TEST_BASE_URL;
if (!configuredTarget) throw new Error("ORB_TEST_BASE_URL is required for owner UAT");
const expectedTargetOrigin = new URL(configuredTarget).origin;

async function gotoApprovedTarget(page: Page, path: string) {
  const requestedUrl = new URL(path, configuredTarget);
  await page.goto(path);
  const finalUrl = new URL(page.url());
  expect(finalUrl.origin, `navigation escaped approved UAT origin at ${path}`).toBe(expectedTargetOrigin);
  expect(finalUrl.pathname, `navigation escaped approved UAT route at ${path}`).toBe(requestedUrl.pathname);
  expect([...finalUrl.searchParams.entries()].sort(), `navigation changed approved UAT query at ${path}`)
    .toEqual([...requestedUrl.searchParams.entries()].sort());
  expect(finalUrl.hash, `navigation changed approved UAT fragment at ${path}`).toBe(requestedUrl.hash);
}

const locales = [
  { locale: "en", direction: "ltr" },
  { locale: "ar", direction: "rtl" },
] as const;

for (const { locale, direction } of locales) {
  test(`owner UAT technical journey exposes the P0 lifecycle in ${locale}`, async ({ page, request }) => {
    const expectedReadinessUrl = new URL("/api/health/ready", configuredTarget);
    const readiness = await request.get(expectedReadinessUrl.pathname);
    expect(readiness.status()).toBe(200);
    expect(readiness.headers()["content-type"], "readiness must be an explicit JSON response")
      .toMatch(/^application\/json(?:\s*;|$)/i);
    expect(readiness.headers()["cache-control"], "readiness must not be served from a reusable cache")
      .toMatch(/(?:^|,)\s*no-store\s*(?:,|$)/i);
    const readinessUrl = new URL(readiness.url());
    expect(readinessUrl.origin, "readiness escaped approved UAT origin").toBe(expectedTargetOrigin);
    expect(readinessUrl.pathname, "readiness escaped approved UAT route").toBe(expectedReadinessUrl.pathname);
    expect(readinessUrl.search, "readiness added unexpected UAT query parameters").toBe(expectedReadinessUrl.search);
    const readinessBody = await readiness.json();
    expect(readinessBody).toMatchObject({ status: "ready" });
    expect(readinessBody.release?.gitCommit).toBe(expectedReleaseCommit);

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
