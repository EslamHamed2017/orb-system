import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { approvals: "Fixed approval inbox", users: "Pilot users and sessions", backup: "Backup and isolated restore", decide: "Approval decision", revoke: "Revoke exact session", start: "Start isolated restore test" },
  ar: { approvals: "صندوق الموافقات الثابت", users: "مستخدمو الإصدار التجريبي والجلسات", backup: "النسخ الاحتياطي والاستعادة المعزولة", decide: "قرار الموافقة", revoke: "إلغاء الجلسة المحددة", start: "بدء اختبار استعادة معزول" },
} as const;
function region(page: Page, name: string | RegExp): Locator { return page.getByRole("region", { name }); }

for (const locale of ["en", "ar"] as const) {
  test(`${locale} approval inbox renders the complete typed exact decision item`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/approvals?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.approvals })).toBeVisible();
    const dialog = region(page, text.decide);
    for (const value of ["EXTERNAL_SEND", "OUTBOUND_MANIFEST", "ORB-MAN-0007"]) await expect(dialog.getByText(value, { exact: true })).toBeVisible();
    await expect(dialog.getByText(/version 3|الإصدار 3/i)).toBeVisible();
    await expect(dialog.getByText(/[a-f0-9]{64}/)).toBeVisible();
    await expect(dialog.getByRole("table", { name: /changed fields|الحقول المتغيرة/i })).toContainText("orderedToRecipients");
    await expect(dialog.getByRole("link", { name: /EVIDENCE-0007/i })).toBeVisible();
    await expect(dialog.getByText(/blocking.*recipient changed|حظر.*تغير المستلم/i)).toBeVisible();
    await expect(dialog.getByText(/requested by.*operations user|مقدم الطلب.*مستخدم العمليات/i)).toBeVisible();
    await expect(dialog.getByText(/required role.*owner.admin|الدور المطلوب.*المالك/i)).toBeVisible();
    await expect(dialog.getByText(/approval.*pending.*version 2|الموافقة.*قيد الانتظار.*الإصدار 2/i)).toBeVisible();
    await expect(dialog.getByText(/self.approval.*forbidden|الموافقة الذاتية.*محظورة/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /approve|موافقة/i })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: /reject|رفض/i })).toBeVisible();
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
  const users = region(page, /fixed pilot roles/i);
  for (const role of ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]) await expect(users.getByText(role, { exact: true })).toBeVisible();
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
