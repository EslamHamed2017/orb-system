import { expect, test, type Page } from "@playwright/test";

const storageKey = "orb.user-projects.owner-1.v1";
const project = {
  id: "project-finance-1", code: "ORB-P-0099", customer: "Atlas Foods", supplier: "Coast Exporters", reference: "AF-101", contractReference: "SC-44", purchaseContractReference: "PC-17",
  startDate: "2026-11-01", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", value: 84000, origin: "Mombasa", destination: "Dubai", status: "ACTIVE",
  supplierShipment: { reference: "SS-001", expectedArrival: "2026-11-02", quantity: "20" }, customerShipment: { reference: "CS-001", plannedDispatchDate: "2026-11-05", quantity: "20" }, customerShipmentReviewedAt: "2026-11-05T10:00:00.000Z",
  supplierInvoice: { reference: "SI-001", invoiceDate: "2026-11-05", amount: "80000" }, supplierPayment: { reference: "SP-001", paymentDate: "2026-11-06", amount: "80000" },
  customerInvoice: { reference: "CI-001", invoiceDate: "2026-11-06", amount: "84000" }, customerCollections: [{ reference: "COL-001", collectionDate: "2026-11-07", amount: "40000" }, { reference: "COL-002", collectionDate: "2026-11-08", amount: "44000" }],
  expenses: [{ reference: "EXP-001", occurredOn: "2026-11-07", category: "Freight", vendor: "Port Services", amount: "1200" }], claims: [],
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-08T12:00:00.000Z",
};

async function seed(page: Page): Promise<void> { await page.addInitScript(({ storageKey, project }) => localStorage.setItem(storageKey, JSON.stringify([project])), { storageKey, project }); }

const routes = [
  ["supplier-invoices", "Supplier invoices", "SI-001", "supplier-finance"],
  ["supplier-payments", "Supplier payments", "SP-001", "supplier-finance"],
  ["sales-invoices", "Customer invoices", "CI-001", "customer-finance"],
  ["collections", "Collections", "COL-002", "customer-finance"],
  ["expenses", "Expenses", "EXP-001", "expenses"],
] as const;

test("finance task routes show only persisted user-entered records and exact project actions", async ({ page }) => {
  await seed(page);
  for (const [route, title, reference, task] of routes) {
    await page.goto(`/accounts/${route}?locale=en&role=finance-viewer`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const card = page.locator("article").filter({ hasText: reference });
    await expect(card).toContainText("ORB-P-0099");
    await expect(card).toContainText("USD");
    await expect(card.getByRole("link", { name: "Open project task" })).toHaveAttribute("href", task === "expenses" ? "/projects/project-finance-1/expenses?locale=en&role=finance-viewer" : `/projects/project-finance-1/overview?locale=en&role=finance-viewer#${task}`);
    await expect(page.locator("body")).not.toContainText(/SINV-2026-014|PINV-2026-031|COL-2026-014|PAY-2026-031|EXP-2026-018|CONFIRMED|POSTED|APPROVED|DEMO/);
  }
  await page.goto("/accounts/sales-invoices?locale=en&role=finance-viewer");
  await page.getByRole("link", { name: "Open project task" }).click();
  await expect(page).toHaveURL(/\/projects\/project-finance-1\/overview\?locale=en&role=finance-viewer#customer-finance$/);
  await expect(page.getByText("Read-only view").first()).toBeVisible();
  await expect(page.locator("main form")).toHaveCount(0);
  await expect(page.locator("main button")).toHaveCount(0);
  await page.getByRole("link", { name: "Project expenses" }).click();
  await expect(page).toHaveURL(/\/projects\/project-finance-1\/expenses\?locale=en&role=finance-viewer$/);
  await expect(page.getByText("Read-only view")).toBeVisible();
  await expect(page.locator("main form")).toHaveCount(0);
  await page.getByRole("link", { name: "Project overview" }).click();
  await expect(page).toHaveURL(/\/projects\/project-finance-1\/overview\?locale=en&role=finance-viewer$/);
  await expect(page.locator("main form")).toHaveCount(0);
});

test("finance task routes expose honest empty and corrupt-storage states", async ({ page }) => {
  await page.goto("/accounts/supplier-invoices?locale=en");
  await expect(page.getByRole("heading", { level: 2, name: "No saved records yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a project" })).toHaveAttribute("href", "/projects?locale=en");
  await page.goto("/accounts/supplier-invoices?locale=en&projectId=missing");
  await expect(page.getByRole("heading", { level: 2, name: "Project not found" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "No saved records yet" })).toHaveCount(0);
  await page.evaluate((key) => localStorage.setItem(key, "{"), storageKey);
  await page.reload();
  const invalidData = page.getByRole("alert").filter({ has: page.getByRole("heading", { name: "Saved project data is invalid" }) });
  await expect(invalidData).toBeVisible();
  await expect(invalidData).toContainText("Restore a known-good local backup");
});

for (const locale of ["en", "ar"] as const) test(`${locale} persisted finance register is readable on desktop and mobile`, async ({ page }) => {
  await seed(page);
  await page.goto(`/accounts/sales-invoices?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "فواتير العملاء" : "Customer invoices" })).toBeVisible();
  await expect(page.getByText(locale === "ar" ? "مُحصّلة بالكامل" : "Collected in full")).toBeVisible();
  const output = "artifacts/ui-review/product-finance-task-pages-20261115";
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${output}/desktop-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const bottom = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navigationTop: Math.round(bottom.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navigationTop);
  await page.screenshot({ path: `${output}/mobile-${locale}.png`, fullPage: true });
});
