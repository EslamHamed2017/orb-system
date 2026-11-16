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
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [{ id: "11111111-1111-4111-8111-111111111111", reference: "CUS-101", legalName: "Atlas Trading", contactName: "Mona Ali", email: "accounts@atlas.example", phone: "+971 50 123 4567", legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 }], nextCursor: null }) }));
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Atlas Trading");
  await expect(page.getByRole("table")).toContainText("Mona Ali");
  await expect(page.getByRole("table")).toContainText("accounts@atlas.example");
  await expect(page.locator("body")).not.toContainText("Northstar Roasters");
});

test("customer creation posts only the strict server payload and trusts only a valid response", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [], nextCursor: null }) });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222222", reference: "CUS-102", legalName: "Coffee Company", contactName: "Sara Saleh", email: "accounts@coffee.example", phone: null, legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("heading", { name: "No customers registered yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill(" cus-102 ");
  await page.getByLabel("Legal name", { exact: true }).fill(" Coffee Company ");
  await page.getByLabel("Contact name").fill(" Sara Saleh ");
  await page.getByLabel("Email").fill(" Accounts@Coffee.Example ");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByRole("status")).toHaveText("Customer saved by the server.");
  expect(requests).toEqual([{ reference: "CUS-102", legalName: "Coffee Company", legalNameAr: null, contactName: "Sara Saleh", email: "accounts@coffee.example", phone: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null }]);
  await expect(page.getByRole("table")).toContainText("CUS-102");
});

test("customer creation requires email or international phone before contacting the server", async ({ page }) => {
  let postCount = 0;
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "POST") postCount += 1;
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [], nextCursor: null }) });
  });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-NO-CONTACT");
  await page.getByLabel("Legal name", { exact: true }).fill("No Contact Customer");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("Enter an email or international phone number before saving.", { exact: true })).toBeVisible();
  expect(postCount).toBe(0);
});

test("invalid success response never fabricates a saved customer", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [], nextCursor: null }) });
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-103"); await page.getByLabel("Legal name", { exact: true }).fill("Not Saved");
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
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [{ id: "55555555-5555-4555-8555-555555555555", reference: "CUS-AR", legalName: "شركة أطلس", contactName: "منى علي", email: "accounts@atlas.example", phone: null, legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 }], nextCursor: null }) }));
  await page.goto("/masters/customers?locale=ar");
  await expect(page.getByRole("button", { name: "إضافة عميل" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("شركة أطلس");
  await expect(page.locator("main > section")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("a create 403 is a form error and preserves the authorized read-only directory", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [{ id: "33333333-3333-4333-8333-333333333333", reference: "CUS-403", legalName: "Finance Customer", contactName: null, email: "finance@example.test", phone: null, legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 }], nextCursor: null }) });
    return route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ code: "PERMISSION_DENIED" }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Finance Customer");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-404"); await page.getByLabel("Legal name", { exact: true }).fill("Denied Customer");
  await page.getByLabel("Email").fill("denied@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("You do not have permission to save customers.", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Finance Customer");
  await expect(page.getByRole("heading", { name: "Customer access is not permitted" })).toHaveCount(0);
  await expect(page.getByLabel("Customer summary").locator("strong").first()).toHaveText("1");
});

test("a create 401 clears prior tenant rows and aggregates before showing sign-in state", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [{ id: "44444444-4444-4444-8444-444444444444", reference: "CUS-401", legalName: "Prior Tenant Customer", contactName: null, email: null, phone: "+966 50 123 4567", legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 2 }], nextCursor: null }) });
    return route.fulfill({ status: 401, contentType: "application/problem+json", body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED" }) });
  });
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("table")).toContainText("Prior Tenant Customer");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-NEW"); await page.getByLabel("Legal name", { exact: true }).fill("New Customer");
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByRole("heading", { name: "Sign-in required" })).toBeVisible();
  await expect(page.getByText("Prior Tenant Customer", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByLabel("Customer summary").locator("strong")).toHaveText(["0", "0", "0"]);
});


test("persisted customer detail edits and archives with optimistic server updates", async ({ page }) => {
  const id = "66666666-6666-4666-8666-666666666666";
  let customer = { id, reference: "CUS-DETAIL", legalName: "Atlas Trading", contactName: "Mona Ali", email: "accounts@atlas.example", phone: null, legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 3 } as const;
  const patches: Array<{ body: unknown; ifMatch: string | undefined }> = [];
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [customer], nextCursor: null }) }));
  await page.route(`**/api/customers/${id}`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(customer) });
    patches.push({ body: route.request().postDataJSON(), ifMatch: route.request().headers()["if-match"] });
    const patch = route.request().postDataJSON() as Partial<typeof customer>;
    customer = { ...customer, ...patch, version: customer.version + 1 };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(customer) });
  });

  await page.goto("/masters/customers?locale=en");
  await page.getByRole("link", { name: "Atlas Trading" }).click();
  await expect(page).toHaveURL(`/customers/${id}?locale=en`);
  await expect(page.getByRole("heading", { level: 1, name: "Atlas Trading" })).toBeVisible();
  await page.getByLabel("Legal name", { exact: true }).fill("Atlas Coffee Trading");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Customer changes saved by the server.");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Archive this customer? Any unsaved form changes will be lost.");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Archive customer" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Reactivate this customer? Any unsaved form changes will be lost.");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Reactivate customer" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  expect(patches).toEqual([
    { body: { legalName: "Atlas Coffee Trading", legalNameAr: null, contactName: "Mona Ali", email: "accounts@atlas.example", phone: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null }, ifMatch: '"3"' },
    { body: { status: "INACTIVE" }, ifMatch: '"4"' },
    { body: { status: "ACTIVE" }, ifMatch: '"5"' },
  ]);
});

test("Arabic customer link preserves locale into the server-backed detail", async ({ page }) => {
  const customer = { id: "77777777-7777-4777-8777-777777777777", reference: "CUS-AR-DETAIL", legalName: "شركة أطلس", contactName: null, email: null, phone: "+971 50 123 4567", legalNameAr: null, countryCode: null, taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 };
  await page.route("**/api/customers", async (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [customer], nextCursor: null }) }));
  await page.route(`**/api/customers/${customer.id}`, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(customer) }));
  await page.goto("/masters/customers?locale=ar");
  await page.getByRole("link", { name: "شركة أطلس" }).click();
  await expect(page).toHaveURL(`/customers/${customer.id}?locale=ar`);
  await expect(page.locator("main > section")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "حفظ التغييرات" })).toBeVisible();
});


test("customer detail edits a bilingual commercial profile without exposing technical values", async ({ page }) => {
  const id = "88888888-8888-4888-8888-888888888888";
  let customer = { id, reference: "CUS-PROFILE", legalName: "Atlas Trading", legalNameAr: "شركة أطلس", contactName: "Mona Ali", email: "accounts@atlas.example", phone: null, countryCode: "AE", taxRegistrationNumber: "100200300", paymentTermsDays: 30, billingAddress: { line1: "Coffee District", line2: null, city: "Dubai", region: "Dubai", postalCode: null }, status: "ACTIVE", version: 1 };
  await page.route(`**/api/customers/${id}`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(customer) });
    customer = { ...customer, ...route.request().postDataJSON(), version: customer.version + 1 };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(customer) });
  });
  await page.goto(`/customers/${id}?locale=ar`);
  await expect(page.getByLabel("الاسم القانوني بالعربية")).toHaveValue("شركة أطلس");
  await expect(page.getByLabel("الدولة")).toHaveValue("AE");
  await expect(page.getByLabel("الرقم الضريبي")).toHaveValue("100200300");
  await expect(page.getByLabel("أجل السداد بالأيام")).toHaveValue("30");
  await expect(page.getByLabel("العنوان", { exact: true })).toHaveValue("Coffee District");
  await page.getByLabel("المدينة").fill("أبوظبي");
  await page.getByRole("button", { name: "حفظ التغييرات" }).click();
  await expect(page.getByRole("status")).toHaveText("حفظ الخادم تغييرات العميل.");
});


test("Arabic directory uses and searches the Arabic legal name", async ({ page }) => {
  const customer = { id: "99999999-9999-4999-8999-999999999999", reference: "CUS-AR-NAME", legalName: "Atlas Coffee", legalNameAr: "شركة أطلس للقهوة", contactName: null, email: "atlas@example.test", phone: null, countryCode: "AE", taxRegistrationNumber: null, paymentTermsDays: 0, billingAddress: null, status: "ACTIVE", version: 1 };
  await page.route("**/api/customers", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [customer], nextCursor: null }) }));
  await page.goto("/masters/customers?locale=ar&q=أطلس");
  await expect(page.getByRole("link", { name: "شركة أطلس للقهوة" })).toBeVisible();
});

test("partial billing address is not silently discarded", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/customers", async route => { if (route.request().method() === "POST") posts++; return route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-schema-version": "2" }, body: JSON.stringify({ items: [], nextCursor: null }) }); });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill("CUS-ADDRESS");
  await page.getByLabel("Legal name", { exact: true }).fill("Address Customer");
  await page.getByLabel("Email").fill("address@example.test");
  await page.getByLabel("City", { exact: true }).fill("Dubai");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  await expect(page.getByText("Enter both billing address line 1 and city, or leave all address fields blank.", { exact: true })).toBeVisible();
  expect(posts).toBe(0);
});


test("legacy customer server capability keeps base create usable without sending profile fields", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/customers", async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], nextCursor: null }) });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", reference: "CUS-LEGACY", legalName: "Legacy Buyer", contactName: null, email: "legacy@example.test", phone: null, status: "ACTIVE", version: 1 }) });
  });
  await page.goto("/masters/customers?locale=en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByLabel("Arabic legal name")).toHaveCount(0);
  await page.getByLabel("Reference").fill("CUS-LEGACY");
  await page.getByLabel("Legal name", { exact: true }).fill("Legacy Buyer");
  await page.getByLabel("Email").fill("legacy@example.test");
  await page.getByRole("button", { name: "Save customer on server" }).click();
  expect(requests).toEqual([{ reference: "CUS-LEGACY", legalName: "Legacy Buyer", contactName: null, email: "legacy@example.test", phone: null }]);
});

test("legacy customer detail keeps base contact edits usable without profile fields", async ({ page }) => {
  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; const patches: unknown[] = [];
  const legacy = { id, reference: "CUS-OLD", legalName: "Old Buyer", contactName: "Mona", email: "old@example.test", phone: null, status: "ACTIVE", version: 2 };
  await page.route(`**/api/customers/${id}`, async route => { if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(legacy) }); patches.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...legacy, ...route.request().postDataJSON(), version: 3 }) }); });
  await page.goto(`/customers/${id}?locale=en`);
  await expect(page.getByLabel("Arabic legal name")).toHaveCount(0);
  await page.getByLabel("Contact name").fill("Mona Ali");
  await page.getByRole("button", { name: "Save changes" }).click();
  expect(patches).toEqual([{ legalName: "Old Buyer", contactName: "Mona Ali", email: "old@example.test", phone: null }]);
});
