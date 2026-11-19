import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { approvals: "Approval requests", users: "Users and access", backup: "Project backup", decide: "Approval decision", revoke: "Revoke exact session" },
  ar: { approvals: "طلبات الموافقة", users: "المستخدمون والوصول", backup: "نسخة احتياطية للمشاريع", decide: "قرار الموافقة", revoke: "إلغاء الجلسة المحددة" },
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
  const user = { id: "019a5f9b-7c00-7000-8000-00000000a002", login: "ops@orb.test", nameEn: "Ops User", nameAr: "العمليات", locale: "en", status: "ACTIVE", activeSessionCount: 1, lastActiveAt: "2026-11-19T08:00:00.000Z", mustChangePassword: false, createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z" };
  const users = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"].map((role, index) => ({ ...user, id: user.id.slice(0, -1) + index, login: `${role.toLowerCase()}@orb.test`, roleCodes: [role] }));
  await page.route("**/api/users", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: users }) }));
  await page.route("**/api/users/*/sessions", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [
    { sessionId: "019a5f9b-7c00-7000-8000-0000000000a7", createdAt: "2026-11-19T08:00:00.000Z", expiresAt: "2026-11-19T20:00:00.000Z", revokedAt: null, active: true },
    { sessionId: "019a5f9b-7c00-7000-8000-0000000000a6", createdAt: "2026-11-18T08:00:00.000Z", expiresAt: "2026-11-18T20:00:00.000Z", revokedAt: "2026-11-18T09:00:00.000Z", active: false },
  ] }) }));
  await page.goto("/admin/users?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: copy.en.users })).toBeVisible();
  const directory = region(page, /user directory/i);
  for (const name of ["Owner administrator", "Operations", "Finance"]) await expect(directory.getByRole("table").getByText(name, { exact: true })).toBeVisible();
  await page.locator(`#manage-${users[1].id} > summary`).click();
  const sessions = region(page, /exact user sessions/i).first();
  const active = sessions.getByTestId("session-active");
  await expect(active).toContainText(/signed in.*expires/i);
  await expect(active.getByRole("button", { name: copy.en.revoke })).toBeVisible();
  const revoked = sessions.getByTestId("session-revoked");
  await expect(revoked).toContainText(/ended/i);
  await expect(revoked.getByRole("button", { name: copy.en.revoke })).toHaveCount(0);
});

test("project backup is truthful about browser-local access and exposes usable actions without fabricated recovery evidence", async ({ page }) => {
  await page.goto("/admin/backup?locale=en&role=operations");
  await expect(page.getByRole("heading", { level: 1, name: copy.en.backup })).toBeVisible();
  await expect(page.getByText("0 projects saved in this browser", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download backup" })).toBeVisible();
  await expect(page.getByLabel("Choose backup file")).toBeAttached();
  await expect(page.locator("body")).toContainText("the file is unencrypted");
  await expect(page.locator("body")).toContainText("This evaluation page does not enforce authenticated roles");
  await expect(page.locator("body")).not.toContainText(/RPO|RTO|AES-256|PASSED|EVIDENCE-RESTORE|password|secret|access key|credential/i);
});

test("admin pages remain contained and expose no deferred controls", async ({ page }) => {
  for (const path of ["/approvals", "/projects/demo/audit", "/admin/users", "/admin/backup"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${path}?locale=ar`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator("body")).not.toContainText(/approval designer|configurable rules|bank import|tax pack|route designer/i);
  }
});
