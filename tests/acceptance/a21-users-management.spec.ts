import { expect, test, type Page } from "@playwright/test";

const USERS = [
  { id: "019a5f9b-7c00-7000-8000-00000000a001", login: "owner@orb.test", nameEn: "Owner Admin", nameAr: "المالك", locale: "ar", status: "ACTIVE", roleCodes: ["OWNER_ADMIN"], activeSessionCount: 1, lastActiveAt: "2026-11-19T08:00:00.000Z", mustChangePassword: false, createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z" },
  { id: "019a5f9b-7c00-7000-8000-00000000a002", login: "ops@orb.test", nameEn: "Ops User", nameAr: "العمليات", locale: "en", status: "ACTIVE", roleCodes: ["OPERATIONS"], activeSessionCount: 0, lastActiveAt: null, mustChangePassword: true, createdAt: "2026-11-02T08:00:00.000Z", updatedAt: "2026-11-02T08:00:00.000Z" },
  { id: "019a5f9b-7c00-7000-8000-00000000a003", login: "finance@orb.test", nameEn: "Finance User", nameAr: "المالية", locale: "en", status: "SUSPENDED", roleCodes: ["FINANCE_VIEWER"], activeSessionCount: 0, lastActiveAt: null, mustChangePassword: false, createdAt: "2026-11-03T08:00:00.000Z", updatedAt: "2026-11-03T08:00:00.000Z" },
];

/** The users screen reads and writes only through /api/users; these tests stub that API. */
async function stubUsers(page: Page, posts: unknown[] = []) {
  await page.route("**/api/users", async (route) => {
    if (route.request().method() === "POST") {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(USERS[1]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: USERS }) });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} full users management supports bilingual lifecycle administration`, async ({ page }) => {
    const ar = locale === "ar";
    await stubUsers(page);
    await page.goto(`/admin/users?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المستخدمون والوصول" : "Users and access" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 2, name: ar ? "دليل المستخدمين" : "User directory" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("link", { name: ar ? "إضافة مستخدم" : "Add user" })).toHaveAttribute("data-operation-id", "createUser");
    await expect(page.getByRole("link", { name: ar ? "إدارة" : "Manage", exact: true }).first()).toHaveAttribute("data-operation-id", "updateUser");
    await expect(page.locator('button[data-operation-id="assignFixedPilotRoles"]')).toHaveCount(3);
    await expect(page.getByText(ar ? "كلمة مرور مؤقتة" : "Temporary password", { exact: true })).toBeVisible();
  });
}

test("create user posts the strict payload with roles and a temporary password", async ({ page }) => {
  const posts: unknown[] = [];
  await stubUsers(page, posts);
  await page.goto("/admin/users?locale=en");
  await page.getByRole("link", { name: "Add user" }).click();
  const form = page.locator("#create-user");
  await form.locator('[name="login"]').fill("new.user@orb.test");
  await form.locator('[name="nameEn"]').fill("New User");
  await form.locator('[name="nameAr"]').fill("مستخدم جديد");
  await form.getByRole("checkbox", { name: "Finance" }).check();
  await form.locator('[name="password"]').fill("Temporary9pass");
  await form.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("status").filter({ hasText: "User created" })).toBeVisible();
  expect(posts).toEqual([{ login: "new.user@orb.test", nameEn: "New User", nameAr: "مستخدم جديد", locale: "en", roleCodes: ["OPERATIONS", "FINANCE_VIEWER"], password: "Temporary9pass" }]);
});

test("users directory filters lifecycle and non-owners are refused by the server", async ({ page }) => {
  await stubUsers(page);
  await page.goto("/admin/users?locale=en&status=SUSPENDED");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("table").getByText("finance@orb.test", { exact: true })).toBeVisible();

  await page.unroute("**/api/users");
  await page.route("**/api/users", (route) => route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ status: 403, code: "PERMISSION_DENIED" }) }));
  await page.goto("/admin/users?locale=en");
  await expect(page.locator(".notice[role=alert]")).toContainText("Only an owner administrator can manage users.");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create user" })).toHaveCount(0);
});
