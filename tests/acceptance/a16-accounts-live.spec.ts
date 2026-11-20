import { expect, test, type Page } from "@playwright/test";

/** Accounts screens, the Accounts report and the printable sales invoice read live APIs; these checks stub those APIs. */
const PROJECT = "33333333-3333-7333-8333-333333333333";
const record = (over: Record<string, unknown>) => ({ id: "44444444-4444-7444-8444-444444444444", projectId: PROJECT, type: "SALES_INVOICE", occurredOn: "2026-11-19", state: "ISSUED", reference: "ORB-INV-2026-000001", currency: "USD", amount: "117120.000000", outstandingAmount: "67120.000000", projectReference: "ORB-PRJ-2026-000001", partyName: "Hamburg Roasters GmbH", documentId: null, href: "/sales-shipments/55555555-5555-7555-8555-555555555555", ...over });
const LISTS: Record<string, unknown[]> = {
  "sales-invoices": [record({}), record({ id: "44444444-4444-7444-8444-444444444445", reference: "ORB-INV-2026-000002", outstandingAmount: "0.000000", state: "ISSUED" })],
  "supplier-invoices": [record({ type: "SUPPLIER_INVOICE", reference: "AD-2026-0091", state: "CONFIRMED", partyName: "Aden Coffee Exporters", amount: "99849.600000", outstandingAmount: "39849.600000", documentId: "66666666-6666-7666-8666-666666666666" })],
  collections: [record({ type: "COLLECTION", reference: "TT-HAM-0001", state: "PARTIALLY_ALLOCATED", amount: "70000.000000", outstandingAmount: "20000.000000" })],
  "supplier-payments": [record({ type: "SUPPLIER_PAYMENT", reference: "TT-ADEN-0001", state: "FULLY_ALLOCATED", partyName: "Aden Coffee Exporters", amount: "60000.000000", outstandingAmount: "0.000000" })],
  expenses: [record({ type: "EXPENSE", reference: "Freight", state: "APPROVED", partyName: "Gulf Forwarders LLC", amount: "1850.000000", outstandingAmount: "0.000000" })],
};
const SUMMARY = { projectId: null, recordCount: 6, currencySections: [{ currency: "USD", salesInvoiced: "234240.000000", salesOutstanding: "67120.000000", supplierInvoiced: "99849.600000", supplierOutstanding: "39849.600000", collections: "70000.000000", supplierPayments: "60000.000000", expenses: "1850.000000", netOperationalCash: "8150.000000" }] };

async function stub(page: Page, status = 200) {
  await page.route("**/api/accounts/**", (route) => {
    const url = new URL(route.request().url());
    const type = url.pathname.split("/").pop()!;
    if (status !== 200) return route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ status, code: status === 403 ? "PERMISSION_DENIED" : "DEPENDENCY_UNAVAILABLE" }) });
    if (type === "summary") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUMMARY) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projectId: url.searchParams.get("projectId"), type, items: LISTS[type] ?? [] }) });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} Accounts overview shows what customers owe, what we owe and net cash per currency`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page);
    await page.goto(`/accounts?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الحسابات" : "Accounts" })).toBeVisible();
    const usd = page.getByTestId("accounts-USD");
    await expect(usd).toContainText("67,120.00");
    await expect(usd).toContainText("39,849.60");
    await expect(usd).toContainText("8,150.00");
    await expect(page.getByRole("link", { name: ar ? "فاتورة مبيعات" : "Sales invoice" })).toHaveAttribute("href", `/accounts/sales-invoices?locale=${locale}`);
    await expect(page.locator("body")).not.toContainText(/general ledger posting|PINV-2026|COL-2026/i);
  });

  test(`${locale} every Accounts register lists live records with links, documents and open amounts`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [view, reference] of [["sales-invoices", "ORB-INV-2026-000001"], ["supplier-invoices", "AD-2026-0091"], ["collections", "TT-HAM-0001"], ["supplier-payments", "TT-ADEN-0001"], ["expenses", "Freight"]] as const) {
      await page.goto(`/accounts/${view}?locale=${locale}`);
      const table = page.getByTestId("accounts-records");
      await expect(table.getByRole("link", { name: reference })).toHaveAttribute("href", /\?locale=/);
      await expect(table.getByRole("link", { name: "ORB-PRJ-2026-000001" }).first()).toHaveAttribute("href", `/projects/${PROJECT}/overview?locale=${locale}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${view} fits a phone`).toBeLessThanOrEqual(1);
    }
    await page.goto(`/accounts/supplier-invoices?locale=${locale}`);
    await expect(page.getByTestId("accounts-records").getByRole("link", { name: ar ? "المستند" : "Document" })).toHaveAttribute("href", "/api/evidence/66666666-6666-7666-8666-666666666666/content");
    await page.goto(`/accounts/sales-invoices?locale=${locale}`);
    await expect(page.getByTestId("accounts-records").locator("tbody tr")).toHaveCount(2);
    await page.getByLabel(ar ? "غير المدفوعة فقط" : "Only unpaid").check();
    await expect(page.getByTestId("accounts-records").locator("tbody tr")).toHaveCount(1);
  });
}

test("a project filter is passed to the API and can be cleared", async ({ page }) => {
  await stub(page);
  const seen: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/accounts/")) seen.push(request.url()); });
  await page.goto(`/accounts/collections?locale=en&projectId=${PROJECT}`);
  await expect(page.getByText("Showing one project.")).toBeVisible();
  await expect.poll(() => seen.some((url) => url.includes(`projectId=${PROJECT}`))).toBe(true);
  await expect(page.getByRole("link", { name: "Show all projects" })).toHaveAttribute("href", "/accounts/collections?locale=en");
});

test("Accounts are refused plainly for roles without access", async ({ page }) => {
  await stub(page, 403);
  await page.goto("/accounts/sales-invoices?locale=en");
  await expect(page.locator(".accounts-alert")).toContainText("Accounts are for finance and owners.");
});

for (const locale of ["en", "ar"] as const) {
  test(`${locale} Accounts report shows dated records with totals per currency`, async ({ page }) => {
    const ar = locale === "ar";
    const urls: string[] = [];
    await page.route("**/api/reports/accounts**", (route) => {
      urls.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reportType: "ACCOUNTS", projectId: null, from: null, to: null, items: [LISTS["sales-invoices"][0], LISTS.collections[0]], summary: { "USD.SALES_INVOICE.amount": "117120.000000", "USD.SALES_INVOICE.outstanding": "67120.000000", "USD.COLLECTION.amount": "70000.000000", "USD.COLLECTION.outstanding": "20000.000000" } }) });
    });
    await page.goto(`/reports/accounts?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "تقرير الحسابات التشغيلي" : "Accounts operational report" })).toBeVisible();
    await expect(page.getByTestId("accounts-report-USD")).toContainText("117,120.00");
    await expect(page.getByTestId("accounts-report-rows").getByRole("link", { name: "ORB-INV-2026-000001" })).toBeVisible();
    await page.getByLabel(ar ? "من" : "From", { exact: true }).fill("2026-11-01");
    await page.getByRole("button", { name: ar ? "تطبيق" : "Apply" }).click();
    await expect.poll(() => urls.some((url) => url.includes("from=2026-11-01"))).toBe(true);
  });
}

test("printable tax invoice shows company details, buyer, lines, VAT and total, and asks for missing company details", async ({ page }) => {
  const id = "44444444-4444-7444-8444-444444444444";
  const company = { legalNameEn: "Gulf Bean Trading LLC", legalNameAr: "الخليج لتجارة البن", addressEn: "", addressAr: "", phone: "", email: "", website: "", trn: "", licenceNo: "",
    bankName: "Emirates NBD", bankAccountName: "Gulf Bean Trading LLC", iban: "AE070331234567890123456", swift: "EBILAEAD", bankCurrency: "USD", termsEn: "", termsAr: "", footerEn: "", footerAr: "",
    brandColor: "#0b5d3b", documentLanguage: "BILINGUAL", vatRegistered: true, logoDataUrl: null };
  await page.route(`**/api/sales-invoices/${id}/print-data`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    invoice: { reference: "ORB-INV-2026-000001", invoiceDate: "2026-11-19", state: "ISSUED", currency: "USD", amount: "122976.00", paid: "0.00", outstanding: "122976.00", shipmentId: "s1",
      vat: { treatment: "STANDARD", rate: "5.00", amount: "5856.00", net: "117120.00" } },
    company, seller: { name: company.legalNameEn, nameAr: null, address: null, taxNumber: null },
    buyer: { reference: "CUS-1", name: "Hamburg Roasters GmbH", nameAr: null, address: "Speicherstadt 1, 20457 Hamburg", taxNumber: "DE123456789", paymentTermsDays: 30 },
    project: { reference: "ORB-PRJ-2026-000001" }, shipment: { reference: "OUT-1", customerPurchaseOrder: "PO-7", containers: ["MSCU1234565"], route: "Jebel Ali, AE → Hamburg, DE", incoterm: "CFR" },
    product: { name: "Yemen Matari", nameAr: "بن يمني" },
    lines: [{ lineNo: 1, description: "Yemen Matari", quantity: "19.200000", unitPrice: "6100.000000", lineAmount: "117120.00" }], paymentTerms: "CAD 30 days", issuedAt: null, issuedByName: "Finance User",
  }) }));
  await page.goto(`/sales-invoices/${id}/print?locale=en`);
  await expect(page.getByRole("heading", { level: 1, name: "Tax Invoice" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "فاتورة ضريبية" })).toBeVisible();
  await expect(page.locator(".doc")).toContainText("Gulf Bean Trading LLC");
  await expect(page.locator(".doc")).toContainText("AE070331234567890123456");
  await expect(page.locator(".doc")).toContainText("Hamburg Roasters GmbH");
  await expect(page.locator(".doc")).toContainText("USD 5,856.00");
  await expect(page.locator(".doc")).toContainText("USD 122,976.00");
  await expect(page.getByRole("note")).toContainText("Add your company address and tax number");
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
});
