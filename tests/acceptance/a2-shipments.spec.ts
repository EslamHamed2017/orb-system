import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { heading: "Shipments", supplier: "Supplier shipment", sales: "Sales shipment", history: "Dataset history", source: "Primary supplier source", revise: "Revise dataset", submit: "Submit for approval", transit: "Mark in transit", received: "Mark received", delivered: "Mark delivered", reject: "Reject shipment", cancel: "Cancel shipment", exception: "Request exception" },
  ar: { heading: "الشحنات", supplier: "شحنة المورد", sales: "شحنة البيع", history: "سجل مجموعة البيانات", source: "مصدر المورد الأساسي", revise: "مراجعة مجموعة البيانات", submit: "إرسال للموافقة", transit: "تحديد قيد النقل", received: "تحديد مستلمة", delivered: "تحديد مسلمة", reject: "رفض الشحنة", cancel: "إلغاء الشحنة", exception: "طلب استثناء" },
} as const;

function workspace(page: Page, kind: "supplier" | "sales"): Locator {
  return page.locator(`[data-shipment-kind="${kind}"]`);
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} shipment workspace exposes typed context, quantities and immutable history`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/shipments?locale=${locale}&state=confirmed`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();

    for (const [kind, name] of [["supplier", text.supplier], ["sales", text.sales]] as const) {
      const area = workspace(page, kind);
      await expect(area.getByRole("heading", { name })).toBeVisible();
      await expect(area.getByText(kind === "supplier" ? "ORB-SUP-0007" : "ORB-SAL-0007", { exact: true })).toBeVisible();
      const historyTable = area.getByRole("table", { name: text.history });
      await expect(historyTable).toBeVisible();
      await expect(historyTable.locator("tbody tr")).toHaveCount(2);
      await expect(historyTable.locator("tbody tr").nth(0)).toContainText("1");
      await expect(historyTable.locator("tbody tr").nth(1)).toContainText("2");
      await expect(area.getByText(/APR-OLD-1/)).toBeVisible();
      await expect(area.getByRole("button", { name: text.revise })).toBeVisible();
      await expect(area.getByRole("button", { name: text.transit })).toBeVisible();
      await expect(area.getByRole("button", { name: text.reject })).toBeVisible();
      await expect(area.getByRole("button", { name: text.cancel })).toBeVisible();
    }

    const sales = workspace(page, "sales");
    await expect(sales.getByRole("combobox", { name: text.source })).toHaveValue("ORB-SUP-0007");
    await expect(sales.getByRole("combobox", { name: text.source }).locator("option:checked")).toHaveCount(1);
    for (const value of ["10,000", "6,000", "2,000", "500", "1,500"]) await expect(sales.getByText(value, { exact: true })).toBeVisible();
  });

  test(`${locale} controls are graph-aware in draft, transit and terminal states`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/shipments?locale=${locale}&state=draft`);
    for (const kind of ["supplier", "sales"] as const) {
      const area = workspace(page, kind);
      await expect(area.getByRole("button", { name: text.submit })).toBeVisible();
      await expect(area.getByRole("button", { name: text.revise })).toBeVisible();
      await expect(area.getByRole("button", { name: text.cancel })).toBeVisible();
      await expect(area.getByRole("button", { name: text.transit })).toHaveCount(0);
    }

    await page.goto(`/projects/demo/shipments?locale=${locale}&state=in-transit`);
    await expect(workspace(page, "supplier").getByRole("button", { name: text.received })).toBeVisible();
    await expect(workspace(page, "sales").getByRole("button", { name: text.delivered })).toBeVisible();
    for (const kind of ["supplier", "sales"] as const) {
      const area = workspace(page, kind);
      await expect(area.getByRole("button", { name: text.reject })).toBeVisible();
      await expect(area.getByRole("button", { name: text.revise })).toHaveCount(0);
      await expect(area.getByRole("button", { name: text.cancel })).toHaveCount(0);
    }

    await page.goto(`/projects/demo/shipments?locale=${locale}&state=delivered`);
    for (const kind of ["supplier", "sales"] as const) {
      const area = workspace(page, kind);
      await expect(area.locator("[data-execution-actions]").getByRole("button")).toHaveCount(0);
      await expect(area.getByRole("button", { name: text.revise })).toHaveCount(0);
    }
  });
}

test("tolerance and approval invalidation remain exact-dataset scoped", async ({ page }) => {
  await page.goto("/projects/demo/shipments?locale=en&state=confirmed&demoState=tolerance");
  const sales = workspace(page, "sales");
  await expect(sales.getByRole("alert")).toContainText(/allowed.*9,900.*10,100.*actual.*10,250/i);
  await expect(sales.getByText(/dataset revision 2.*ORB-SUP-0007/i)).toBeVisible();
  await expect(sales.getByRole("button", { name: /request exception/i })).toBeVisible();
  await expect(sales.getByText(/approval expired.*APR-OLD-1/i)).toBeVisible();
});

test("stale, replay and post-transit revision responses preserve work and explain the next action", async ({ page }) => {
  await page.goto("/projects/demo/shipments?locale=en&state=confirmed&demoState=stale");
  await expect(page.getByRole("alert").filter({ hasText: /newer version/i })).toContainText(/not overwritten/i);
  await expect(page.getByRole("button", { name: /reload latest/i })).toBeVisible();

  await page.goto("/projects/demo/shipments?locale=en&state=confirmed&demoState=replay");
  await expect(page.getByRole("status").filter({ hasText: /already applied/i })).toContainText(/no duplicate event/i);

  await page.goto("/projects/demo/shipments?locale=en&state=in-transit&demoState=post-transit");
  await expect(page.getByRole("alert").filter({ hasText: /revision unavailable/i })).toContainText(/in transit/i);
  await expect(page.getByRole("button", { name: /revise dataset/i })).toHaveCount(0);
});

test("shipment workspaces expose neither a second source nor forbidden revision identity controls", async ({ page }) => {
  await page.goto("/projects/demo/shipments?locale=en&state=confirmed");
  await expect(workspace(page, "sales").getByRole("combobox", { name: /primary supplier source/i })).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/secondary source|multiple sources|bank import|tax pack|route designer/i);
  for (const name of ["shipmentId", "projectId", "reference", "primarySupplierShipmentId"]) await expect(page.locator(`[name="${name}"]`)).toHaveCount(0);
});
