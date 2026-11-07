import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { heading: "Project closure", assessment: "Closure assessment", refresh: "Refresh assessment", blockers: "Closure blockers", exception: "Request exception", finalClose: "Final close", reopen: "Reopen project", panel: "Sales shipment closure" },
  ar: { heading: "إغلاق المشروع", assessment: "تقييم الإغلاق", refresh: "تحديث التقييم", blockers: "موانع الإغلاق", exception: "طلب استثناء", finalClose: "الإغلاق النهائي", reopen: "إعادة فتح المشروع", panel: "إغلاق شحنة البيع" },
} as const;
function region(page: Page, name: string | RegExp): Locator { return page.getByRole("region", { name }); }

for (const locale of ["en", "ar"] as const) {
  test(`${locale} current assessment groups every reachable blocker and exposes exceptions only when eligible`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/closure?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();
    const assessment = region(page, text.assessment);
    await expect(assessment.getByRole("button", { name: text.refresh })).toBeVisible();
    await expect(assessment.getByText(/project version 14|إصدار المشروع 14/i)).toBeVisible();
    await expect(assessment.getByText(/[a-f0-9]{64}/)).toBeVisible();
    const blockers = region(page, text.blockers);
    for (const code of ["SALES_SHIPMENT_NOT_DELIVERED", "ROUTE_ITEM_INCOMPLETE", "SUPPLIER_BALANCE_OUTSTANDING", "CLAIM_INCOMPLETE", "APPROVAL_VERSION_STALE", "AUDIT_INTEGRITY_FAILED", "SECURITY_CONTROL_FAILED"])
      await expect(blockers.getByText(code, { exact: true })).toBeVisible();
    const eligible = blockers.getByTestId("blocker-ROUTE_ITEM_INCOMPLETE");
    await expect(eligible.getByRole("checkbox")).toBeVisible();
    await expect(eligible.getByText(/exception eligible|مؤهل للاستثناء/i)).toBeVisible();
    for (const code of ["SUPPLIER_BALANCE_OUTSTANDING", "APPROVAL_VERSION_STALE", "AUDIT_INTEGRITY_FAILED", "SECURITY_CONTROL_FAILED"])
      await expect(blockers.getByTestId(`blocker-${code}`).getByRole("checkbox")).toHaveCount(0);
    await expect(blockers.getByRole("button", { name: text.exception })).toBeVisible();
  });
}

test("exception request binds one named blocker, current assessment and mandatory reason", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en&demoState=exception");
  const dialog = region(page, /closure exception request/i);
  await expect(dialog.getByText("ROUTE_ITEM_INCOMPLETE", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/assessment ASSESSMENT-0014/i)).toBeVisible();
  await expect(dialog.getByText(/project version 14/i)).toBeVisible();
  await expect(dialog.getByLabel(/exception reason/i)).toHaveValue("Customs evidence delayed by authority");
  await expect(dialog.getByText(/approval.*pending/i)).toBeVisible();
});

test("final close remains approval/apply controlled and blocked until all blockers are absent or covered", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en&demoState=blocked");
  await expect(region(page, /final close/i).getByRole("button", { name: /submit final close/i })).toBeDisabled();
  await expect(region(page, /final close/i).getByText(/7 uncovered blockers/i)).toBeVisible();
  await page.goto("/projects/demo/closure?locale=en&demoState=approved");
  const close = region(page, /final close/i);
  await expect(close.getByText(/fresh assessment.*ASSESSMENT-0015/i)).toBeVisible();
  await expect(close.getByText(/approval.*approved/i)).toBeVisible();
  await expect(close.getByRole("button", { name: /apply final close/i })).toBeVisible();
});

test("basis invalidation immediately reopens Final Close and expires stale assessment and exceptions", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en&demoState=invalidated");
  const result = region(page, /closure basis changed/i);
  await expect(result.getByText(/final close reopened/i)).toBeVisible();
  await expect(result.getByText(/document revised/i)).toBeVisible();
  await expect(result.getByText(/assessment ASSESSMENT-0015.*invalidated/i)).toBeVisible();
  await expect(result.getByText(/exception approval.*expired/i)).toBeVisible();
  await expect(result.getByRole("link", { name: /refresh assessment/i })).toBeVisible();
});

test("closed project requires reason-bound approval to reopen and shows recomputed financial state", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en&demoState=closed");
  const reopen = region(page, /reopen project/i);
  await expect(reopen.getByLabel(/reopen reason/i)).toHaveValue("Customer refund requires settlement review");
  await expect(reopen.getByText(/project version 16/i)).toBeVisible();
  await expect(reopen.getByText(/approval.*approved/i)).toBeVisible();
  await expect(reopen.getByRole("button", { name: /apply reopen/i })).toBeVisible();
  await expect(reopen.getByText(/recomputed financial state.*financially closed/i)).toBeVisible();
});

test("stable sales-shipment Closure panel is composable and keeps independent axes visible", async ({ page }) => {
  await page.goto("/projects/demo/closure?locale=en");
  const panel = region(page, /sales shipment closure/i);
  await expect(panel.getByText("ORB-SAL-0007", { exact: true })).toBeVisible();
  await expect(panel.getByText(/execution.*delivered/i)).toBeVisible();
  await expect(panel.getByText(/finance.*financially closed/i)).toBeVisible();
  await expect(panel.getByText(/documents.*complete/i)).toBeVisible();
  await expect(panel.getByText(/claims.*under review/i)).toBeVisible();
});

test("closure workspace remains contained at compact, tablet and desktop widths", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/demo/closure?locale=ar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
