import { expect, test, type Locator, type Page } from "@playwright/test";

const salesTabs = ["Dataset", "Route checklist", "Evidence", "Documents", "Settlement", "Expense", "Claims", "Closure"] as const;
const supplierTabs = ["Dataset & actions", "Evidence", "Invoice & payment", "Statement"] as const;

function workspace(page: Page, kind: "sales" | "supplier"): Locator {
  return page.locator(`[data-complete-shipment-workspace="${kind}"]`);
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} complete shipment pages expose each contracted workspace panel exactly once`, async ({ page }) => {
    const salesLabels = locale === "ar"
      ? ["مجموعة البيانات", "قائمة المسار", "الدليل", "المستندات", "التسوية", "المصروف", "المطالبات", "الإغلاق"]
      : salesTabs;
    const supplierLabels = locale === "ar"
      ? ["مجموعة البيانات والإجراءات", "الدليل", "الفاتورة والدفع", "البيان"]
      : supplierTabs;

    await page.goto(`/sales-shipments/demo?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    const sales = workspace(page, "sales");
    const salesTablist = sales.getByRole("tablist", { name: /sales shipment workspace|مساحة شحنة البيع/i });
    await expect(salesTablist.getByRole("tab")).toHaveCount(8);
    for (const label of salesLabels) await expect(salesTablist.getByRole("tab", { name: label, exact: true })).toHaveCount(1);
    for (const panel of ["sales-dataset", "sales-route", "sales-evidence", "sales-documents", "sales-settlement", "sales-expense", "sales-claims", "sales-closure"])
      await expect(sales.locator(`#${panel}`)).toHaveCount(1);

    await page.goto(`/supplier-shipments/demo?locale=${locale}`);
    const supplier = workspace(page, "supplier");
    const supplierTablist = supplier.getByRole("tablist", { name: /supplier shipment workspace|مساحة شحنة المورد/i });
    await expect(supplierTablist.getByRole("tab")).toHaveCount(4);
    for (const label of supplierLabels) await expect(supplierTablist.getByRole("tab", { name: label, exact: true })).toHaveCount(1);
    for (const panel of ["supplier-dataset", "supplier-evidence", "supplier-invoice-payment", "supplier-statement"])
      await expect(supplier.locator(`#${panel}`)).toHaveCount(1);
  });
}

test("composed panels retain their implemented backend bindings and operational actions", async ({ page }) => {
  await page.goto("/sales-shipments/demo?locale=en");
  const sales = workspace(page, "sales");
  const expectedSalesBindings = {
    "sales-dataset": "/api/sales-shipments/demo",
    "sales-route": "/api/sales-shipments/demo/route-checklist",
    "sales-evidence": "/api/evidence",
    "sales-documents": "/api/sales-shipments/demo/documents",
    "sales-settlement": "/api/projects/demo/profit",
    "sales-expense": "/api/projects/demo/expenses",
    "sales-claims": "/api/projects/demo/claims",
    "sales-closure": "/api/projects/demo/closure-assessment",
  } as const;
  for (const [id, endpoint] of Object.entries(expectedSalesBindings)) await expect(sales.locator(`#${id}`)).toHaveAttribute("data-backend-endpoint", endpoint);
  await expect(sales.getByRole("button", { name: /mark in transit/i })).toHaveCount(1);
  await expect(sales.getByRole("button", { name: /upload and verify/i })).toHaveCount(1);
  await expect(sales.getByRole("button", { name: /submit document for approval/i })).toHaveCount(1);

  await page.goto("/supplier-shipments/demo?locale=en");
  const supplier = workspace(page, "supplier");
  await expect(supplier.locator("#supplier-dataset")).toHaveAttribute("data-backend-endpoint", "/api/supplier-shipments/demo");
  await expect(supplier.locator("#supplier-evidence")).toHaveAttribute("data-backend-endpoint", "/api/evidence");
  await expect(supplier.locator("#supplier-invoice-payment")).toHaveAttribute("data-backend-endpoint", "/api/supplier-shipments/demo/invoices");
  await expect(supplier.locator("#supplier-statement")).toHaveAttribute("data-backend-endpoint", "/api/statements/supplier-shipment/demo");
  await expect(supplier.getByRole("button", { name: /mark in transit/i })).toHaveCount(1);
  await expect(supplier.getByText(/outstanding.*USD 7,500.00/i)).toBeVisible();
});

test("Finance Viewer receives read-shaped workspaces without mutation actions", async ({ page }) => {
  for (const kind of ["sales", "supplier"] as const) {
    await page.goto(`/${kind}-shipments/demo?locale=en&role=finance-viewer`);
    const area = workspace(page, kind);
    await expect(area.getByRole("tab")).toHaveCount(kind === "sales" ? 8 : 4);
    await expect(area.getByRole("button")).toHaveCount(0);
    await expect(area.getByRole("link").first()).toBeVisible();
  }
});

test("composition rejects placeholders, deferred tabs, duplicate controls and compact overflow", async ({ page }) => {
  for (const path of ["/sales-shipments/demo?locale=en", "/supplier-shipments/demo?locale=ar"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(/coming soon|placeholder|not implemented|bank import|tax pack|secondary source|multiple sources|shared expense|route designer|advanced claim/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});


for (const locale of ["en", "ar"] as const) {
  test(`${locale} sales shipment detail exposes contract-bound multiple lines and draft-only creation`, async ({ page }) => {
    await page.goto(`/sales-shipments/demo?locale=${locale}&state=confirmed`);
    const area = workspace(page, "sales");
    const table = area.getByRole("table", { name: locale === "ar" ? "بنود شحنة البيع" : "Sales shipment lines" });
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table).toContainText("SAL-2026-004 · 1");
    await expect(table).toContainText("Ethiopia Guji");
    await expect(table).toContainText(locale === "ar" ? "المتبقي بعد الشحنة" : "Remaining after shipment");
    const fulfillment = area.getByRole("region", { name: locale === "ar" ? "التنفيذ الجزئي" : "Partial fulfillment" });
    await expect(fulfillment.getByRole("progressbar")).toHaveCount(2);
    await expect(fulfillment).toContainText(locale === "ar" ? "الكمية المتبقية" : "Remaining quantity");
    await expect(fulfillment).toContainText("1000 kg");
    await expect(fulfillment).toContainText("500 kg");
    await expect(area.getByRole("form", { name: locale === "ar" ? "إضافة بند شحنة" : "Add shipment line" })).toHaveCount(0);

    await page.goto(`/sales-shipments/demo?locale=${locale}&state=draft`);
    const draft = workspace(page, "sales");
    const form = draft.getByRole("form", { name: locale === "ar" ? "إضافة بند شحنة" : "Add shipment line" });
    await expect(form).toBeVisible();
    const selector = form.getByRole("combobox", { name: locale === "ar" ? "بند العقد المعتمد" : "Approved contract line" });
    await expect(selector.locator("option")).toHaveCount(3);
    await expect(selector.locator("option").nth(1)).toContainText("SAL-2026-004 · 1");
    await expect(form).toHaveAttribute("data-operation-id", "createSalesShipmentLine");
  });
}
