import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { heading: "Direct expenses", form: "Record direct expense", history: "Expense history", correction: "Correct approved expense", shipment: "Sales shipment expenses", scope: "Expense scope", proof: "Proof evidence", submit: "Submit expense for approval", correct: "Correct expense", apply: "Apply approved correction" },
  ar: { heading: "المصروفات المباشرة", form: "تسجيل مصروف مباشر", history: "سجل المصروفات", correction: "تصحيح المصروف المعتمد", shipment: "مصروفات شحنة البيع", scope: "نطاق المصروف", proof: "دليل المصروف", submit: "إرسال المصروف للموافقة", correct: "تصحيح المصروف", apply: "تطبيق التصحيح المعتمد" },
} as const;

function region(page: Page, name: string | RegExp): Locator {
  return page.getByRole("region", { name });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} workspace exposes direct Project-or-shipment scope, proof and approval controls`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/expenses?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();
    const form = region(page, text.form);
    await expect(form.getByLabel(text.scope)).toContainText(locale === "ar" ? "المشروع بالكامل" : "Whole Project");
    await expect(form.getByLabel(text.scope)).toContainText(locale === "ar" ? "شحنة بيع واحدة" : "One sales shipment");
    await expect(form.getByLabel(locale === "ar" ? "شحنة البيع" : "Sales shipment", { exact: true })).toHaveValue("ORB-SAL-0007");
    await expect(form.getByLabel(locale === "ar" ? "المورد" : "Vendor")).toBeVisible();
    await expect(form.getByLabel(locale === "ar" ? "فئة المصروف" : "Expense category")).toBeVisible();
    await expect(form.getByLabel(text.proof)).toBeVisible();
    await expect(form.getByRole("button", { name: text.submit })).toBeVisible();
  });
}

test("approved expenses are immutable and expose Correct rather than Edit or Delete", async ({ page }) => {
  await page.goto("/projects/demo/expenses?locale=en");
  const history = region(page, /expense history/i);
  const approved = history.getByRole("row", { name: /EXP-0007.*approved/i });
  await expect(approved).toContainText("USD 1,250.00");
  await expect(approved.getByRole("button", { name: /correct expense/i })).toBeVisible();
  await expect(history).not.toContainText(/edit expense|delete expense|allocate expense|allocation method/i);
});

test("correction shows exact old/new diff, reason, immutable evidence pair and approved Apply", async ({ page }) => {
  await page.goto("/projects/demo/expenses?locale=en&demoState=correction");
  const correction = region(page, /correct approved expense/i);
  await expect(correction.getByRole("table", { name: /expense correction comparison/i }).locator("tbody tr")).toHaveCount(4);
  await expect(correction.getByRole("row", { name: /amount.*USD 1,250.00.*USD 1,100.00/i })).toBeVisible();
  await expect(correction.getByLabel(/correction reason/i)).toBeVisible();
  await expect(correction.getByText("EVIDENCE-ORIGINAL-0007", { exact: true })).toHaveCount(2);
  await expect(correction.getByText("EVIDENCE-REPLACEMENT-0008", { exact: true })).toHaveCount(2);
  await expect(correction.getByText(/approval.*approved/i)).toBeVisible();
  await expect(correction.getByRole("button", { name: /apply approved correction/i })).toBeVisible();
});

test("applied correction retains linked immutable rows and reports all recomputations", async ({ page }) => {
  await page.goto("/projects/demo/expenses?locale=en&demoState=applied");
  const history = region(page, /expense history/i);
  await expect(history.getByRole("row", { name: /EXP-0007.*cancelled.*EXP-0008/i })).toBeVisible();
  await expect(history.getByRole("row", { name: /EXP-0008.*approved.*EXP-0007/i })).toBeVisible();
  const status = page.getByRole("status").filter({ hasText: /correction applied/i });
  await expect(status).toContainText(/statement recomputed/i);
  await expect(status).toContainText(/margin recomputed/i);
  await expect(status).toContainText(/closure assessment invalidated/i);
  await expect(status).toContainText(/final close reopened/i);
});

test("stable shipment panel exposes direct expense facts without composing the shipment page", async ({ page }) => {
  await page.goto("/projects/demo/expenses?locale=en");
  const shipment = region(page, /sales shipment expenses/i);
  await expect(shipment.getByText("ORB-SAL-0007", { exact: true })).toBeVisible();
  await expect(shipment.getByText("EXP-0007", { exact: true })).toBeVisible();
  await expect(shipment.getByText(/directly scoped.*USD 1,250.00/i)).toBeVisible();
  await expect(shipment).not.toContainText(/shared|multi-shipment|allocation/i);
});
