import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customer directory fails closed when no trusted session is available`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/customers?locale=${locale}`);
    await expect(page.getByRole("heading", { level: 1, name: ar ? "العملاء" : "Customers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { name: ar ? "تسجيل الدخول مطلوب" : "Sign-in required" })).toBeVisible();
    await expect(page.getByText(ar ? "سجّل الدخول لتحميل العملاء وحفظهم." : "Sign in to load and save customers.")).toBeVisible();
    await expect(page.getByRole("button", { name: ar ? "إضافة عميل" : "Add customer" })).toBeDisabled();
    await expect(page.getByText(ar ? "سجلات الخادم فقط" : "Server records only")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Northstar Roasters");
  });
}

test("an authenticated server response is rendered without fixture fallback", async ({ page }) => {
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "11111111-1111-4111-8111-111111111111", reference: "CUS-101", legalName: "Atlas Trading", contactName: "Mona Ali", email: "accounts@atlas.example", phone: "+971 50 123 4567", status: "ACTIVE", version: 1 }], nextCursor: null }) }));
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Atlas Trading");
  await expect(page.getByRole("table")).toContainText("Mona Ali");
  await expect(page.getByRole("table")).toContainText("accounts@atlas.example");
  await expect(page.locator("body")).not.toContainText("Northstar Roasters");
});

test("customer creation posts only the strict server payload and trusts only a valid response", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222222", reference: "CUS-102", legalName: "Coffee Company", contactName: "Sara Saleh", email: "accounts@coffee.example", phone: null, status: "ACTIVE", version: 1 }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("heading", { name: "No customers registered yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill(" cus-102 ");
  await page.getByLabel("Legal name").fill(" Coffee Company ");
  await page.getByLabel("Contact name").fill(" Sara Saleh ");
  await page.getByLabel("Email").fill(" Accounts@Coffee.Example ");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByRole("status")).toHaveText("Customer saved by the server.");
  expect(requests).toEqual([{ reference: "CUS-102", legalName: "Coffee Company", contactName: "Sara Saleh", email: "accounts@coffee.example", phone: null }]);
  await expect(page.getByRole("table")).toContainText("CUS-102");
});

test("customer creation requires email or international phone before contacting the server", async ({ page }) => {
  let postCount = 0;
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "POST") postCount += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) });
  });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-NO-CONTACT");
  await page.getByLabel("Legal name").fill("No Contact Customer");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("Enter an email or international phone number before saving.", { exact: true })).toBeVisible();
  expect(postCount).toBe(0);
});

test("invalid success response never fabricates a saved customer", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) });
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-103"); await page.getByLabel("Legal name").fill("Not Saved");
  await page.getByLabel("Email").fill("not-saved@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("The server returned an invalid response. No saved record was shown.", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("mobile Arabic fail-closed state remains responsive above bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/masters/customers?locale=ar");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول مطلوب" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => { const main = document.querySelector(".orb-main")!.getBoundingClientRect(); const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect(); return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) }; });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
});


test("mobile Arabic persisted customer state keeps the primary action visible without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "55555555-5555-4555-8555-555555555555", reference: "CUS-AR", legalName: "شركة أطلس", contactName: "منى علي", email: "accounts@atlas.example", phone: null, status: "ACTIVE", version: 1 }], nextCursor: null }) }));
  await page.goto("/masters/customers?locale=ar");
  await expect(page.getByRole("button", { name: "إضافة عميل" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("شركة أطلس");
  await expect(page.locator("main > section")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("a create 403 is a form error and preserves the authorized read-only directory", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "33333333-3333-4333-8333-333333333333", reference: "CUS-403", legalName: "Finance Customer", contactName: null, email: "finance@example.test", phone: null, status: "ACTIVE", version: 1 }], nextCursor: null }) });
    return route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ code: "PERMISSION_DENIED" }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Finance Customer");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-404"); await page.getByLabel("Legal name").fill("Denied Customer");
  await page.getByLabel("Email").fill("denied@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("You do not have permission to save customers.", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Finance Customer");
  await expect(page.getByRole("heading", { name: "Customer access is not permitted" })).toHaveCount(0);
  await expect(page.getByLabel("Customer summary").locator("strong").first()).toHaveText("1");
});

test("a create 401 clears prior tenant rows and aggregates before showing sign-in state", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "44444444-4444-4444-8444-444444444444", reference: "CUS-401", legalName: "Prior Tenant Customer", contactName: null, email: null, phone: "+966 50 123 4567", status: "ACTIVE", version: 2 }], nextCursor: null }) });
    return route.fulfill({ status: 401, contentType: "application/problem+json", body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED" }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Prior Tenant Customer");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-NEW"); await page.getByLabel("Legal name").fill("New Customer");
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByRole("heading", { name: "Sign-in required" })).toBeVisible();
  await expect(page.getByText("Prior Tenant Customer", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByLabel("Customer summary").locator("strong")).toHaveText(["0", "0", "0"]);
});
