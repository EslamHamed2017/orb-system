import { expect, test } from "@playwright/test";

test("isolated infrastructure is ready and current route states remain truthful", async ({ page, request }) => {
  test.setTimeout(180_000);
  const readiness = await request.get("/api/health/ready");
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toMatchObject({ status: "ready", checks: { auditChain: "up", database: "up", objectStorage: "up" } });

  const lifecycle = [
    "/masters/customers", "/masters/suppliers", "/masters/products", "/projects/demo/overview",
    "/projects/demo/contracts", "/supplier-shipments/demo", "/sales-shipments/demo",
    "/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201", "/accounts/supplier-invoices?projectId=project-1",
    "/accounts/collections?projectId=project-1", "/accounts/supplier-payments?projectId=project-1",
    "/accounts/expenses?projectId=project-1", "/attachments", "/reports/product-movement",
    "/projects/demo/closure",
  ] as const;
  for (const route of lifecycle) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}locale=en`);
    await expect(page.locator("main").first(), route).toBeVisible();
    await expect(page.locator("body"), route).not.toContainText(/application error|internal server error/i);
  }

  await page.goto("/projects/demo/contracts?locale=en");
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByText(/print/i).first()).toBeVisible();
  await expect(page.getByText(/attachment/i).first()).toBeVisible();

  await page.goto("/supplier-shipments/demo?locale=en");
  await expect(page.getByText(/2 suppliers|supplier count/i).first()).toBeVisible();
  await expect(page.getByText(/separate supplier invoice/i).first()).toBeVisible();

  await page.goto("/sales-shipments/demo?locale=en&state=confirmed");
  await expect(page.getByText("Remaining quantity", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(2);

  await page.goto("/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201&locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Sales invoices" })).toBeVisible();
  await expect(page.getByText("Sales shipment").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "ORB-R1-SAL-100MT" })).toBeVisible();
  await expect(page.getByText(/attachment/i).first()).toBeVisible();

  await page.goto("/accounts/supplier-invoices?projectId=project-1&locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Supplier invoices" })).toBeVisible();
  await expect(page.getByText("Supplier container").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "supplier-container-1" })).toBeVisible();
  await expect(page.getByText(/attachment/i).first()).toBeVisible();

  await page.goto("/reports/product-movement?locale=en");
  await expect(page.locator("body")).toContainText(/not a stock balance or inventory valuation/i);
});
