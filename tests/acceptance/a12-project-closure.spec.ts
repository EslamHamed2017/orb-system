import { expect, test, type Page } from "@playwright/test";

const key = "orb.user-projects.owner-1.v1";
const eligible = {
  id: "project-close-1", code: "ORB-P-0099", customer: "Atlas Foods", supplier: "Coast Exporters", reference: "AF-101", contractReference: "SC-44", purchaseContractReference: "PC-17",
  startDate: "2026-11-01", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", value: 84000, origin: "Mombasa", destination: "Dubai", status: "ACTIVE",
  supplierShipment: { reference: "SS-001", expectedArrival: "2026-11-02", quantity: "20" }, customerShipment: { reference: "CS-001", plannedDispatchDate: "2026-11-05", quantity: "20" }, customerShipmentReviewedAt: "2026-11-05T10:00:00.000Z",
  supplierInvoice: { reference: "SI-001", invoiceDate: "2026-11-05", amount: "80000" }, supplierPayment: { reference: "SP-001", paymentDate: "2026-11-06", amount: "80000" },
  customerInvoice: { reference: "CI-001", invoiceDate: "2026-11-06", amount: "84000" }, customerCollections: [{ reference: "COL-001", collectionDate: "2026-11-07", amount: "84000" }], expenses: [{ reference: "EXP-001", occurredOn: "2026-11-07", category: "Freight", vendor: "Port Services", amount: "1200" }], claims: [],
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-07T12:00:00.000Z",
};
async function seed(page: Page) { await page.addInitScript(({ key, eligible }) => localStorage.setItem(key, JSON.stringify([eligible])), { key, eligible }); }

test("user closes and reopens an eligible persisted project in English", async ({ page }) => {
  await seed(page);
  await page.goto("/projects/project-close-1/closure?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Close project" })).toBeVisible();
  await expect(page.getByText("Ready to close", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/DEMO|ASSESSMENT-|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);
  await page.locator('[name="closedOn"]').fill("2026-11-08");
  await page.locator('[name="note"]').fill("All recorded obligations reviewed");
  await page.getByRole("button", { name: "Close project" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: "Project closed" })).toBeVisible();
  await page.screenshot({ path: "artifacts/product-project-closure-20261114/desktop-en-closed.png", fullPage: true });
  await page.locator('[name="reopenedOn"]').fill("2026-11-09");
  await page.locator('[name="reason"]').fill("Customer requested a documented adjustment");
  await page.getByRole("button", { name: "Reopen project" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: "Project reopened" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reopened work" })).toBeVisible();
  await expect(page.getByText("Customer requested a documented adjustment", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark reopened work reviewed" }).click();
  await expect(page.getByText("Ready to close", { exact: true })).toBeVisible();
  const record = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]")[0], key);
  expect(record.status).toBe("ACTIVE");
  expect(record.closure.reopenReason).toBe("Customer requested a documented adjustment");
  expect(record.closure.reopenReviewedAt).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "artifacts/product-project-closure-20261114/mobile-en-reopened.png", fullPage: true });
  const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  await page.locator('[name="closedOn"]').fill(today);
  await page.locator('[name="note"]').fill("Reopened work reviewed and completed");
  await page.getByRole("button", { name: "Close project" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: "Project closed" })).toBeVisible();
  const reclosed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]")[0], key);
  expect(reclosed.status).toBe("CLOSED");
  expect(reclosed.closure.note).toBe("Reopened work reviewed and completed");
  expect(reclosed.closure.reopenedAt).toBeUndefined();
});

test("Arabic closure uses business copy, RTL, persisted values, and mobile-safe actions", async ({ page }) => {
  await seed(page);
  await page.goto("/projects/project-close-1/closure?locale=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "إغلاق المشروع" })).toBeVisible();
  await expect(page.getByText("جاهز للإغلاق", { exact: true })).toBeVisible();
  await page.locator('[name="closedOn"]').fill("2026-11-08");
  await page.locator('[name="note"]').fill("تمت مراجعة جميع الالتزامات المسجلة");
  await page.getByRole("button", { name: "إغلاق المشروع" }).click();
  await expect(page.getByText("تم إغلاق المشروع", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/ACTIVE|CLOSED|DEMO|ASSESSMENT-|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);
  await page.screenshot({ path: "artifacts/product-project-closure-20261114/desktop-ar-closed.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "artifacts/product-project-closure-20261114/mobile-ar-closed.png", fullPage: true });
});


test("legacy closed records show an honest read-only state without fabricated closure details", async ({ page }) => {
  await page.addInitScript(({ key, eligible }) => localStorage.setItem(key, JSON.stringify([{ ...eligible, status: "CLOSED" }])), { key, eligible });
  await page.goto("/projects/project-close-1/closure?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Project closed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Closure details unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close project" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reopen project" })).toHaveCount(0);
});
