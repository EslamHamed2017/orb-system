import { expect, test, type Page } from "@playwright/test";

/** Today and the shipments list read live records; these checks stub the read APIs to pin the daily-work layout. */
const PROJECT = "33333333-3333-7333-8333-333333333333";
const items = [
  { type: "SALES", id: "44444444-4444-7444-8444-444444444444", reference: "OUT-REFERENCE-WITH-A-VERY-LONG-CUSTOMER-PO-2026-0001", projectId: PROJECT, projectReference: "ORB-PRJ-2026-000001", counterpartyName: "Hamburg Roasters GmbH & Co. KG Speicherstadt", quantity: "19.200", state: "DRAFT", estimatedDeparture: null, estimatedArrival: null, waitingForApproval: false, hasSource: false, invoiceState: null },
  { type: "SUPPLIER", id: "55555555-5555-7555-8555-555555555555", reference: "IN-9", projectId: PROJECT, projectReference: "ORB-PRJ-2026-000001", counterpartyName: "Aden Coffee Exporters", quantity: "19.200", state: "IN_TRANSIT", estimatedDeparture: "2026-11-01", estimatedArrival: "2099-01-01", waitingForApproval: false, hasSource: null, invoiceState: "CONFIRMED" },
];

async function stub(page: Page) {
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) }));
  await page.route("**/api/shipments", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) }));
  await page.route("**/api/approvals", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("**/api/reports/project-profitability", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) }));
}

test("Today next steps stay readable above mobile navigation", async ({ page }) => {
  await stub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?locale=en");
  const first = page.getByTestId("today-steps").locator("li").first();
  await expect(first).toBeVisible();
  await expect(page.getByTestId("today-steps").getByRole("link", { name: /Confirm OUT-REFERENCE/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await first.scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="today-steps"] li')!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')?.getBoundingClientRect();
    return { cardBottom: Math.round(card.bottom), navTop: Math.round(nav?.top ?? Number.MAX_SAFE_INTEGER) };
  });
  expect(geometry.cardBottom).toBeLessThanOrEqual(geometry.navTop);
});

for (const locale of ["en", "ar"] as const) {
  test(`${locale} shipments list shows every shipment with its next step and filters`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/shipments?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الشحنات" : "Shipments" })).toBeVisible();
    const table = page.getByTestId("shipments-queue");
    await expect(table.getByRole("link", { name: "IN-9" })).toHaveAttribute("href", `/supplier-shipments/55555555-5555-7555-8555-555555555555?locale=${locale}`);
    await expect(table).toContainText(ar ? "تأكيد الشحنة" : "Confirm shipment");
    await expect(table).toContainText(ar ? "تحديد الاستلام عند الوصول" : "Mark received on arrival");
    await page.getByRole("button", { name: ar ? "إلى العملاء" : "To customers" }).click();
    await expect(table.getByRole("link", { name: "IN-9" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: ar ? "بحث" : "Search", exact: true }).fill("nothing-matches");
    await expect(page.getByText(ar ? "لا توجد شحنات مطابقة." : "No shipments match.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("shipments list failure is visible and recoverable", async ({ page }) => {
  let fail = true;
  await page.route("**/api/shipments", (route) => fail
    ? route.fulfill({ status: 503, contentType: "application/problem+json", body: "{}" })
    : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) }));
  await page.goto("/shipments?locale=en");
  await expect(page.locator(".queue-alert")).toContainText("Shipments could not be loaded.");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("shipments-queue").getByRole("link", { name: "IN-9" })).toBeVisible();
});
