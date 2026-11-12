import { expect, test } from "@playwright/test";

test("central attachments index filters by project and links to the exact source", async ({ page }) => {
  await page.goto("/attachments?locale=en&projectId=demo");
  await expect(page.getByRole("heading", { name: "Central attachments index" })).toBeVisible();
  await expect(page.getByRole("row", { name: /signed-sales-contract\.pdf/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /freight-receipt\.pdf/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "SAL-2026-004" })).toHaveAttribute("href", "/projects/demo/contracts?locale=en&recordId=contract-14");
  await expect(page.getByRole("link", { name: "Details" }).first()).toHaveAttribute("href", /\/evidence\/.*\?locale=en/);
  await expect(page.getByRole("link", { name: "Attachments", exact: true })).toHaveAttribute("aria-current", "page");
});

test("central attachments index preserves Arabic RTL and transaction filters", async ({ page }) => {
  await page.goto("/attachments?locale=ar&subjectType=CLAIM&verificationState=REJECTED");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "فهرس المرفقات المركزي" })).toBeVisible();
  await expect(page.getByRole("row", { name: /inspection-report\.pdf/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /signed-sales-contract\.pdf/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "CLM-2026-007" })).toHaveAttribute("href", "/projects/project-atlas/claims?locale=ar&recordId=claim-7");
});
