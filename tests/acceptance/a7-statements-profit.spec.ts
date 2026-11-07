import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: {
    statements: "Operational statements", profit: "Profit and cash", tabs: "Statement types",
    project: "Project", customer: "Customer", supplier: "Supplier", sales: "Sales shipment",
    supplierShipment: "Supplier shipment", source: "Source", expected: "Expected margin",
    committed: "Committed margin", actual: "Actual operational margin", cash: "Cash position",
    drilldown: "Source drill-down", panel: "Supplier shipment statement", asOf: "As of 30 Nov 2026",
  },
  ar: {
    statements: "البيانات التشغيلية", profit: "الربح والنقد", tabs: "أنواع البيان",
    project: "المشروع", customer: "العميل", supplier: "المورد", sales: "شحنة البيع",
    supplierShipment: "شحنة المورد", source: "المصدر", expected: "الهامش المتوقع",
    committed: "الهامش الملتزم", actual: "الهامش التشغيلي الفعلي", cash: "المركز النقدي",
    drilldown: "تفاصيل المصادر", panel: "بيان شحنة المورد", asOf: "حتى 30 نوفمبر 2026",
  },
} as const;

function region(page: Page, name: string | RegExp): Locator {
  return page.getByRole("region", { name });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} fixed statement tabs preserve currency sections, running balances and source links`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/statements?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.statements })).toBeVisible();
    const tabs = page.getByRole("tablist", { name: text.tabs });
    for (const name of [text.project, text.customer, text.supplier, text.sales, text.supplierShipment]) {
      await expect(tabs.getByRole("tab", { name, exact: true })).toBeVisible();
    }
    for (const currency of ["USD", "EUR"]) {
      const section = region(page, locale === "ar" ? new RegExp(`بيان.*${currency}`, "i") : new RegExp(`${currency}.*statement`, "i"));
      await expect(section.getByRole("table")).toBeVisible();
      await expect(section.getByText(locale === "ar" ? /الرصيد الجاري/ : /running balance/i)).toBeVisible();
      await expect(section.getByRole("link", { name: new RegExp(text.source, "i") }).first()).toBeVisible();
      await expect(section.getByText(/unexplained variance.*0\.000000|فرق غير مفسر.*0\.000000/i)).toBeVisible();
    }
  });

  test(`${locale} profit view keeps four measures distinct with as-of, formulas and drill-down`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/profit?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: text.profit })).toBeVisible();
    await expect(page.getByText(text.asOf, { exact: true })).toBeVisible();
    for (const name of [text.expected, text.committed, text.actual, text.cash]) {
      const card = region(page, name);
      await expect(card.getByText(/USD/)).toBeVisible();
      await expect(card.getByText(locale === "ar" ? /المعادلة/ : /formula/i)).toBeVisible();
      await expect(card.getByText(/ORB-R1-PROFIT-1/)).toBeVisible();
      await expect(card.getByRole("button", { name: text.drilldown })).toBeVisible();
    }
    const expected = region(page, text.expected);
    await expect(expected.getByText(/AED/)).toBeVisible();
    await expect(expected.getByText(/3\.672500.*2026-11-01.*ORB_RECORDED_RATE/)).toBeVisible();
  });
}

test("source drill-down discloses immutable inputs while operations shaping hides sensitive cost values", async ({ page }) => {
  await page.goto("/projects/demo/profit?locale=en&demoState=drilldown");
  const detail = region(page, /source drill-down/i);
  await expect(detail.getByText("PURCHASE-CONTRACT-0007", { exact: true })).toBeVisible();
  await expect(detail.getByText("USD 700.000000", { exact: true })).toBeVisible();
  await expect(detail.getByText(/input hash/i)).toBeVisible();
  await expect(detail.getByText(/[a-f0-9]{64}/)).toBeVisible();

  await page.goto("/projects/demo/profit?locale=en&demoState=drilldown&role=operations");
  const shaped = region(page, /source drill-down/i);
  await expect(shaped.getByText("PURCHASE-CONTRACT-0007", { exact: true })).toBeVisible();
  await expect(shaped.getByText(/restricted by role/i)).toBeVisible();
  await expect(shaped).not.toContainText("USD 700.000000");
});

test("stable supplier-shipment statement panel remains composable and source-drillable", async ({ page }) => {
  await page.goto("/projects/demo/statements?locale=en");
  const panel = region(page, /supplier shipment statement/i);
  await expect(panel.getByText("ORB-SUP-0007", { exact: true })).toBeVisible();
  await expect(panel.getByText("USD -700.000000", { exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: /source SUPPLIER-INVOICE-0007/i })).toBeVisible();
});

test("statement and profit workspaces remain usable at compact, tablet and desktop widths", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["statements?locale=ar", "profit?locale=en"]) {
      await page.goto(`/projects/demo/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
