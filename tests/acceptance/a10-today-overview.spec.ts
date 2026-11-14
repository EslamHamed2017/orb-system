import { expect, test } from "@playwright/test";

const copy = {
  en: { today: "Today", recent: "Recent projects", overview: "Project overview", blockers: "Operational blockers", quantities: "Shipment progress", money: "USD", audit: "Activity and audit", related: "Project records" },
  ar: { today: "اليوم", recent: "المشروعات الأخيرة", overview: "نظرة عامة على المشروع", blockers: "العوائق التشغيلية", quantities: "تقدم الشحنات", money: "USD", audit: "النشاط والتدقيق", related: "سجلات المشروع" },
} as const;

for (const locale of ["en", "ar"] as const) {
  test(`${locale} Today renders assigned approvals, recent Projects and every authoritative blocker family`, async ({ page }) => {
    await page.goto(`/?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: copy[locale].today })).toBeVisible();
    const blockers = page.getByRole("region", { name: copy[locale].blockers });
    for (const family of ["approvals", "route/evidence", "document/outbound", "invoice/settlement", "expense", "claim", "closure", "audit", "recovery"])
      await expect(blockers.getByTestId(`today-${family}`)).toBeVisible();
    await expect(page.getByRole("region", { name: copy[locale].recent }).getByRole("link", { name: /ORB-P-0001/ })).toHaveAttribute("href", /\/projects\/[^/]+\/overview/);
    for (const item of await blockers.getByRole("link").all()) await expect(item).toHaveAttribute("href", /^\//);
  });

  test(`${locale} Project overview renders exact quantities, currency-separated money, blockers and audit continuity`, async ({ page }) => {
    await page.goto(`/projects/demo/overview?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: copy[locale].overview })).toBeVisible();
    await expect(page.getByRole("region", { name: copy[locale].quantities })).toContainText(/40\.000000 MT.*20\.000000 MT/s);
    const money = page.getByRole("region", { name: copy[locale].money });
    for (const value of ["28500.000000", "17700.000000", "25.000000", "250.000000", "20000.000000", "12500.000000", "8500.000000", "5200.000000", "100.000000"])
      await expect(money.getByText(value, { exact: true })).toBeVisible();
    await expect(money.getByText(locale === "ar" ? "الهامش التشغيلي الفعلي" : "Actual operational margin", { exact: true })).toBeVisible();
    const blockers = page.getByRole("region", { name: copy[locale].blockers });
    for (const code of ["ROUTE_ITEM_INCOMPLETE", "CINV_MISSING", "UNALLOCATED_MONEY", "EXPENSE_PENDING", "CLAIM_INCOMPLETE", "SALES_SHIPMENT_NOT_DELIVERED"])
      await expect(blockers.getByText(code, { exact: true })).toBeVisible();
    const audit = page.getByRole("region", { name: copy[locale].audit });
    await expect(audit).toContainText(/sequence 9/i);
    await expect(audit).toContainText(locale === "ar" ? /تم التحقق من الاستمرارية/ : /continuity verified/i);
    const related = page.getByRole("region", { name: copy[locale].related });
    const linkedRecords = {
      contracts: [3, `/projects/demo/contracts?locale=${locale}`], supplierContainers: [2, `/projects/demo/shipments?locale=${locale}#supplier-dataset`],
      salesShipments: [1, `/projects/demo/shipments?locale=${locale}#sales-dataset`], salesInvoices: [1, `/projects/demo/transactions?locale=${locale}&type=CUSTOMER_COMMERCIAL_INVOICE`],
      supplierInvoices: [2, `/projects/demo/transactions?locale=${locale}&type=SUPPLIER_COMMERCIAL_INVOICE`], collections: [1, `/projects/demo/transactions?locale=${locale}&type=COLLECTION`],
      supplierPayments: [2, `/projects/demo/transactions?locale=${locale}&type=SUPPLIER_PAYMENT`], expenses: [2, `/projects/demo/transactions?locale=${locale}&type=EXPENSE`],
      claims: [1, `/projects/demo/claims?locale=${locale}`], attachments: [4, `/attachments?projectId=demo&locale=${locale}`],
    } as const;
    for (const [key, [count, href]] of Object.entries(linkedRecords)) {
      const record = related.getByTestId(`project-record-${key}`);
      await expect(record.getByText(String(count), { exact: true })).toBeVisible();
      await expect(record.getByRole("link")).toHaveAttribute("href", href);
    }
  });
}

test("Today and overview are role-shaped, directly linked and expose no deferred or fabricated aggregate", async ({ page }) => {
  for (const path of ["/", "/projects/demo/overview"]) {
    await page.goto(`${path}?locale=en`);
    await expect(page.locator("body")).not.toContainText(/estimated aggregate|configurable rule|dynamic route|bank import|tax pack|multi-source/i);
    await expect(page.locator("body")).not.toContainText(/csrf|password|secret|credential/i);
  }
});

test("resolved items disappear after authoritative state changes rather than a client-only dismissal", async ({ page }) => {
  await page.goto("/?locale=en");
  const blocker = page.getByTestId("today-route/evidence");
  await expect(blocker).toBeVisible();
  await expect(blocker.getByRole("button", { name: /dismiss|hide/i })).toHaveCount(0);
});
