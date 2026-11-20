import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { approvals: "Approval requests", users: "Users and access", backup: "Project backup", decide: "Approval decision", revoke: "Revoke exact session" },
  ar: { approvals: "طلبات الموافقة", users: "المستخدمون والوصول", backup: "نسخة احتياطية للمشاريع", decide: "قرار الموافقة", revoke: "إلغاء الجلسة المحددة" },
} as const;
function region(page: Page, name: string | RegExp): Locator { return page.getByRole("region", { name }); }

const INBOX = { items: [
  { id: "019a5f9b-7c00-7000-8000-0000000000c1", actionCode: "CONTRACT_VERSION", subjectType: "CONTRACT", subjectId: "019a5f9b-7c00-7000-8000-0000000000d1", subjectReference: "ORB-PC-2026-000001", contractKind: "PURCHASE", projectId: "019a5f9b-7c00-7000-8000-0000000000e1", projectReference: "ORB-PRJ-2026-000001", quantity: "40.000000", requesterId: "019a5f9b-7c00-7000-8000-0000000000f1", requesterName: "Sara", requestedAt: "2026-11-19T10:00:00.000Z" },
  { id: "019a5f9b-7c00-7000-8000-0000000000c2", actionCode: "SUPPLIER_SHIPMENT_CONFIRMATION", subjectType: "SUPPLIER", subjectId: "019a5f9b-7c00-7000-8000-0000000000d2", subjectReference: "IN-ADEN-01", projectId: "019a5f9b-7c00-7000-8000-0000000000e1", projectReference: "ORB-PRJ-2026-000001", quantity: "19.200000", requesterId: "019a5f9b-7c00-7000-8000-0000000000f1", requesterName: "Sara", requestedAt: "2026-11-19T11:00:00.000Z" },
] };

for (const locale of ["en", "ar"] as const) {
  test(`${locale} approval inbox lists real requests with business copy and decisions`, async ({ page }) => {
    const text = copy[locale], ar = locale === "ar";
    const decisions: unknown[] = [];
    await page.route("**/api/approvals", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INBOX) }));
    await page.route("**/api/approvals/*/decision", async (route) => { decisions.push(route.request().postDataJSON()); await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
    await page.goto(`/approvals?locale=${locale}`);
    await expect(page.locator(".orb-shell")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.approvals })).toBeVisible();
    const items = page.locator(".orb-inbox article");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(ar ? "عقد (شراء)" : "Contract (purchase)");
    await expect(items.nth(1)).toContainText(ar ? "تأكيد شحنة مورد" : "Supplier shipment confirmation");
    await expect(items.nth(1).getByRole("link", { name: "IN-ADEN-01" })).toHaveAttribute("href", `/supplier-shipments/019a5f9b-7c00-7000-8000-0000000000d2?locale=${locale}`);
    await expect(page.locator(".orb-inbox")).not.toContainText(/CONTRACT_VERSION|SUPPLIER_SHIPMENT_CONFIRMATION/);
    await items.nth(1).getByRole("button", { name: ar ? "رفض…" : "Reject…" }).click();
    await items.nth(1).locator("textarea").fill(ar ? "رقم الختم ناقص" : "Seal number missing");
    await items.nth(1).getByRole("button", { name: ar ? "رفض" : "Reject", exact: true }).click();
    await items.first().getByRole("button", { name: ar ? "اعتماد" : "Approve" }).click();
    await expect.poll(() => decisions.length).toBe(2);
    expect(decisions).toEqual([{ decision: "REJECTED", comment: ar ? "رقم الختم ناقص" : "Seal number missing" }, { decision: "APPROVED" }]);
  });
}

test("approval inbox explains when the signed-in user is not an owner", async ({ page }) => {
  await page.route("**/api/approvals", (route) => route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ status: 403, code: "PERMISSION_DENIED" }) }));
  await page.goto("/approvals?locale=en");
  await expect(page.locator(".orb-inbox-notice")).toContainText("Only an owner administrator can decide approvals.");
});

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

test("backup page is truthful that records are backed up on the server, with no browser export", async ({ page }) => {
  await page.goto("/admin/backup?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Backups" })).toBeVisible();
  await expect(page.locator("body")).toContainText("backed up on the server");
  await expect(page.getByRole("button", { name: /download|restore/i })).toHaveCount(0);
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
