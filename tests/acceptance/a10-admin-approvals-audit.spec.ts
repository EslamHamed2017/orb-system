import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { approvals: "Approval requests", users: "Users and access", backup: "Backup and isolated restore", decide: "Approval decision", revoke: "Revoke exact session", start: "Start isolated restore test" },
  ar: { approvals: "طلبات الموافقة", users: "المستخدمون والوصول", backup: "النسخ الاحتياطي والاستعادة المعزولة", decide: "قرار الموافقة", revoke: "إلغاء الجلسة المحددة", start: "بدء اختبار استعادة معزول" },
} as const;
function region(page: Page, name: string | RegExp): Locator { return page.getByRole("region", { name }); }

for (const locale of ["en", "ar"] as const) {
  test(`${locale} approval request uses business copy and keeps technical values behind disclosure`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/approvals?locale=${locale}`);
    await expect(page.locator(".orb-shell")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.approvals })).toBeVisible();
    const dialog = region(page, locale === "ar" ? "مراجعة إرسال مستندات العميل" : "Review customer document delivery");
    await expect(dialog).toContainText(locale === "ar" ? "إرسال مستندات الشحن إلى العميل" : "Send shipping documents to the customer");
    await expect(dialog).toContainText(locale === "ar" ? "قائمة المستلمين" : "Recipient list");
    await expect(dialog).toContainText(locale === "ar" ? "مالك النظام" : "System owner");
    await expect(dialog).toContainText(locale === "ar" ? "بانتظار القرار" : "Awaiting decision");
    await expect(dialog).toContainText(locale === "ar" ? "خدمة الموافقات غير متصلة" : "Approval service is not connected");
    for (const value of ["EXTERNAL_SEND", "OUTBOUND_MANIFEST", "customer@example.test"]) {
      await expect(dialog.getByText(value, { exact: true })).not.toBeVisible();
    }
    await expect(dialog.getByText(/[a-f0-9]{64}/)).not.toBeVisible();
    await expect(dialog.getByRole("button", { name: /approve|reject|موافقة|رفض/i })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: /shipping-document evidence|حزمة مستندات الشحن/i })).toHaveCount(0);
    await expect(dialog).toContainText(locale === "ar" ? "المرفقات غير متاحة" : "Attachments are unavailable");

    const details = dialog.getByText(locale === "ar" ? "التفاصيل التقنية" : "Technical details", { exact: true });
    await details.click();
    for (const value of ["EXTERNAL_SEND", "OUTBOUND_MANIFEST"]) await expect(dialog.getByText(value, { exact: true })).toBeVisible();
    await expect(dialog.getByText(/[a-f0-9]{64}/)).toBeVisible();
  });
}

test("audit timeline exposes independently verifiable ascending chain and cursor anchors", async ({ page }) => {
  await page.goto("/projects/demo/audit?locale=en");
  const timeline = region(page, /immutable audit timeline/i);
  await expect(timeline.getByText(/page start previous event hash.*null/i)).toBeVisible();
  await expect(timeline.getByText(/page end event hash.*[a-f0-9]{64}/i)).toBeVisible();
  const events = timeline.getByRole("listitem");
  await expect(events).toHaveCount(3);
  await expect(events.nth(0)).toContainText(/sequence 1.*PROJECT_CREATED.*previous event hash.*null/i);
  await expect(events.nth(1)).toContainText(/sequence 2.*CONTRACT_SUBMITTED/i);
  await expect(events.nth(2)).toContainText(/sequence 3.*APPROVAL_DECIDED/i);
  for (let index = 0; index < 3; index += 1) await expect(events.nth(index).getByText(/^Event hash: [a-f0-9]{64}$/)).toBeVisible();
  await expect(timeline.getByText(/chain continuity verified/i)).toBeVisible();
});

test("fixed-role administration shows exact session versions and complete active/revoked metadata", async ({ page }) => {
  await page.goto("/admin/users?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: copy.en.users })).toBeVisible();
  const users = region(page, /user directory/i);
  for (const role of ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]) await expect(users.getByRole("table").getByText(role, { exact: true })).toBeVisible();
  const sessions = region(page, /exact user sessions/i);
  const active = sessions.getByTestId("session-active");
  await expect(active).toContainText(/SESSION-ACTIVE-0007.*version 4.*current.*last seen.*idle expiry.*absolute expiry/i);
  await expect(active).toContainText(/revoked at.*null.*revoked by.*null.*revocation reason.*null/i);
  const revoked = sessions.getByTestId("session-revoked");
  await expect(revoked).toContainText(/SESSION-REVOKED-0006.*version 3.*revoked at.*2026-11-07.*revoked by.*owner user.*security review/i);
  await expect(revoked.getByRole("button", { name: copy.en.revoke })).toHaveCount(0);
  await expect(active.getByRole("button", { name: copy.en.revoke })).toBeVisible();
});

test("backup page is Owner-only and reports encrypted separate-copy recovery evidence without secrets", async ({ page }) => {
  await page.goto("/admin/backup?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: copy.en.backup })).toBeVisible();
  const status = region(page, /recovery status/i);
  await expect(status).toContainText(/owner.admin only.*encrypted.*yes.*separate copy.*yes.*RPO.*12 minutes.*RTO.*38 minutes.*PASSED.*zero missing sampled links/i);
  await expect(status.getByRole("link", { name: /EVIDENCE-RESTORE-0007/i })).toBeVisible();
  await expect(status).not.toContainText(/password|secret|access key|credential/i);
  const restore = region(page, /isolated restore command/i);
  await expect(restore.getByLabel(/isolated environment/i)).toHaveValue("orb-restore-test-0008");
  await expect(restore.getByRole("button", { name: copy.en.start })).toBeVisible();
  await expect(restore).toContainText(/production target prohibited/i);
});

test("admin pages remain contained and expose no deferred controls", async ({ page }) => {
  for (const path of ["/approvals", "/projects/demo/audit", "/admin/users", "/admin/backup"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${path}?locale=ar`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator("body")).not.toContainText(/approval designer|configurable rules|bank import|tax pack|route designer/i);
  }
});
