import { expect, test } from "@playwright/test";

const routes = {
  FOREIGN_TO_FOREIGN: ["Origin and destination", "Transport reference", "Origin/export evidence", "Departure", "Arrival", "Delivery"],
  UAE_FREE_ZONE_REEXPORT: ["Free-zone entry evidence", "Storage and handling evidence", "Exit/re-export customs evidence", "Outbound transport", "Delivery"],
  UAE_IMPORT: ["UAE import declaration", "Customs clearance and assessed charges", "Inbound transport", "Release", "Delivery"],
} as const;

for (const [route, items] of Object.entries(routes)) {
  test(`${route} renders its immutable checklist and closure links without an editor`, async ({ page }) => {
    await page.goto(`/evidence/demo?locale=en&route=${route}&verification=verified`);
    const checklist = page.getByRole("region", { name: /route checklist/i });
    await expect(checklist.getByText(/template version 1/i)).toBeVisible();
    for (const item of items) await expect(checklist.getByText(item, { exact: true })).toBeVisible();
    await expect(checklist.getByRole("link", { name: /view closure blocker/i })).toBeVisible();
    await expect(checklist).not.toContainText(/edit template|route designer|tax classification/i);
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} evidence viewer exposes immutable verified metadata, source links and audited actions`, async ({ page }) => {
    await page.goto(`/evidence/demo?locale=${locale}&route=UAE_IMPORT&verification=verified`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "الدليل" : "Evidence");
    await expect(page.getByText("a".repeat(64), { exact: true })).toBeVisible();
    await expect(page.getByText("application/pdf", { exact: true })).toBeVisible();
    await expect(page.getByText("1,024 bytes", { exact: true })).toBeVisible();
    await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
    await expect(page.getByText("2026-11-07T08:00:00.000Z", { exact: true })).toBeVisible();
    await expect(page.getByText("Owner Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: locale === "ar" ? /عرض الملف/ : /view file/i })).toHaveAttribute("href", /disposition=inline/);
    await expect(page.getByRole("link", { name: locale === "ar" ? /تنزيل/ : /download/i })).toHaveAttribute("href", /disposition=attachment/);
    await expect(page.getByRole("link", { name: /ORB-SAL-0007/ })).toBeVisible();
  });
}

test("pending evidence renders explicit null verification facts and upload hash state", async ({ page }) => {
  await page.goto("/evidence/demo?locale=en&route=UAE_FREE_ZONE_REEXPORT&verification=pending");
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(page.getByText(/not verified yet/i)).toHaveCount(2);
  await expect(page.getByLabel(/evidence file/i)).toBeVisible();
  await expect(page.getByText(/SHA-256 is verified before attachment/i)).toBeVisible();
});

test("Arabic route panel has equivalent actions and a rule-only N/A state", async ({ page }) => {
  await page.goto("/evidence/demo?locale=ar&route=UAE_FREE_ZONE_REEXPORT&verification=verified&storageHandlingUsed=false");
  const checklist = page.getByRole("region", { name: /قائمة مسار الشحنة/ });
  await expect(checklist.getByText("دليل التخزين والمناولة", { exact: true })).toBeVisible();
  await expect(checklist.getByText("غير منطبق حسب القاعدة", { exact: true })).toBeVisible();
  await expect(checklist.getByRole("button", { name: /رفع دليل/ }).first()).toBeVisible();
  await expect(checklist.getByRole("button", { name: /إكمال المرحلة/ })).toBeVisible();
});
