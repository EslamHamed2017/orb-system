import { expect, test } from "@playwright/test";

test("isolated infrastructure is ready and current route states remain truthful", async ({ page, request }) => {
  test.setTimeout(180_000);
  const readiness = await request.get("/api/health/ready");
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toMatchObject({ status: "ready", checks: { auditChain: "up", database: "up", objectStorage: "up" } });

  const lifecycle = [
    "/masters/customers", "/masters/suppliers", "/masters/products", "/projects", "/shipments",
    "/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201", "/accounts/supplier-invoices?projectId=00000000-0000-7000-8000-000000000201",
    "/accounts/collections?projectId=00000000-0000-7000-8000-000000000201", "/accounts/supplier-payments?projectId=00000000-0000-7000-8000-000000000201",
    "/accounts/expenses?projectId=00000000-0000-7000-8000-000000000201", "/attachments", "/reports/product-movement",
  ] as const;
  for (const route of lifecycle) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}locale=en`);
    await expect(page.locator("main").first(), route).toBeVisible();
    await expect(page.locator("body"), route).not.toContainText(/application error|internal server error/i);
  }

  // Accounts read the signed-in company's live records; the acceptance owner's company may have none yet.
  for (const [view, heading] of [["sales-invoices", "Sales invoice"], ["supplier-invoices", "Supplier invoice"], ["collections", "Collection"]] as const) {
    await page.goto(`/accounts/${view}?projectId=00000000-0000-7000-8000-000000000201&locale=en`);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Showing one project.")).toBeVisible();
    await expect(page.getByTestId("accounts-records").or(page.getByText("Nothing recorded yet."))).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/could not be loaded|for finance and owners/i);
  }
  await page.goto("/accounts?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();

  await page.goto("/reports/product-movement?locale=en");
  await expect(page.locator("body")).toContainText(/not a stock balance or inventory valuation/i);
});
