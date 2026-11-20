import { expect, test } from "@playwright/test";

/** Reports center (QuickBooks-style groups) and one report; the accounts APIs are stubbed. */
const record = (type: string, reference: string, occurredOn: string, state: string, aed: string, extra: Record<string, unknown> = {}) =>
  ({ id: reference, projectId: "11111111-1111-7111-8111-111111111111", type, occurredOn, state, partyId: "22222222-2222-7222-8222-222222222222", reference, currency: "USD",
    amount: "1000.000000", outstandingAmount: "0.000000", projectReference: "ORB-PRJ-2026-000001", partyName: "Hamburg Roasters GmbH", documentId: null, href: "/sales-shipments/x",
    aedAmount: aed, aedOutstanding: "0.000000", ...extra });

for (const locale of ["en", "ar"] as const) {
  test(`${locale} reports center groups reports like QuickBooks`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/reports?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "التقارير" : "Reports" })).toBeVisible();
    for (const group of ar ? ["نظرة عامة على العمل", "المستحق لك", "المستحق عليك", "المشاريع", "الشحنات"] : ["Business overview", "Who owes you", "What you owe", "Projects", "Shipments"])
      await expect(page.getByRole("heading", { level: 2, name: group })).toBeVisible();
    await expect(page.getByRole("link", { name: ar ? "الأرباح والخسائر" : "Profit and loss" })).toHaveAttribute("href", `/reports/view/profit-and-loss?locale=${locale}`);
    await expect(page.getByRole("link", { name: ar ? "تنفيذ العقود" : "Contract fulfillment" })).toHaveAttribute("href", `/reports/contract-fulfillment?locale=${locale}`);
    await expect(page.locator('[data-navigation="rail"]').getByRole("link", { name: ar ? "التقارير" : "Reports" })).toHaveAttribute("aria-current", "page");
  });
}

test("profit and loss shows AED totals for the period, drills down and exports to Excel", async ({ page }) => {
  const items: Record<string, unknown[]> = {
    "sales-invoices": [record("SALES_INVOICE", "INV-1", "2026-11-05", "ISSUED", "3672.500000")],
    "supplier-invoices": [record("SUPPLIER_INVOICE", "BILL-1", "2026-11-06", "CONFIRMED", "2203.500000")],
    expenses: [record("EXPENSE", "Freight", "2026-11-07", "APPROVED", "367.250000")],
  };
  await page.route(/\/api\/accounts\/(sales-invoices|supplier-invoices|expenses)(\?.*)?$/, (route) => {
    const key = new URL(route.request().url()).pathname.split("/").pop()!;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ type: key, projectId: null, items: items[key] }) });
  });
  await page.goto("/reports/view/profit-and-loss?locale=en&from=2026-11-01&to=2026-11-30");
  await expect(page.getByRole("heading", { level: 1, name: "Profit and loss" })).toBeVisible();
  const table = page.getByTestId("qb-report-table");
  await expect(table.getByRole("row", { name: /Total income/ })).toContainText("3,672.50");
  await expect(table.getByRole("row", { name: /Net profit/ })).toContainText("1,101.75");
  await expect(table.getByRole("link", { name: "Supplier bills" })).toHaveAttribute("href", "/accounts/supplier-invoices?locale=en");
  const download = page.waitForEvent("download");
  await page.getByTestId("export-xlsx").click();
  expect((await download).suggestedFilename()).toBe("profit-and-loss-2026-11-01-2026-11-30.xlsx");
});
