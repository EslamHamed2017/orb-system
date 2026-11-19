import { expect, test } from "@playwright/test";
import { signInAs, signOutLocally } from "./support/session";

test("operations navigation hides finance and administration while preserving role context", async ({ page }) => {
  await signInAs(page, "operations");
  await page.goto("/projects/demo/contracts?locale=en");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects?locale=en");
  await expect(rail.getByRole("link", { name: "Shipments" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Accounts" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add purchase contract" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Submit for approval" }).first()).toBeEnabled();
});

test("finance navigation exposes operational accounts but not trade mutation or administration", async ({ page }) => {
  await signInAs(page, "finance");
  await page.goto("/accounts?locale=ar");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "الحسابات" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "التقارير" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "العملاء" })).toHaveAttribute("href", "/masters/customers?locale=ar");
  await expect(rail.getByRole("link", { name: "المنتجات" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "الإدارة" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("a URL role parameter cannot grant owner navigation", async ({ page }) => {
  await signInAs(page, "operations");
  await page.goto("/projects/demo/contracts?locale=en&role=owner-admin");
  const rail = page.locator('[data-navigation="rail"]');
  await expect(rail.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Accounts" })).toHaveCount(0);
});

test("without a session every page fails closed to sign-in", async ({ page }) => {
  await signOutLocally(page);
  await page.goto("/projects/demo/contracts?locale=en&role=owner-admin");
  await expect(page).toHaveURL(/\/sign-in\?locale=en&next=/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});


test("finance customer access is discoverable and read-only", async ({ page }) => {
  const customer = { id: "11111111-1111-7111-8111-111111111111", reference: "CUS-FIN-1", legalName: "Finance-visible buyer", contactName: null, email: "buyer@example.test", phone: null, status: "ACTIVE", version: 1 };
  await page.route("**/api/customers", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-write-permitted": "false" }, body: JSON.stringify({ items: [customer], nextCursor: null }) }));
  await signInAs(page, "finance");
  await page.goto("/masters/customers?locale=en");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add customer" })).toHaveCount(0);
  await expect(page.getByText("You can view customers, but your current role cannot change them.", { exact: true })).toBeVisible();
  await page.route("**/api/customers/*", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "x-orb-customer-write-permitted": "false" }, body: JSON.stringify(customer) }));
  await page.goto(`/customers/${customer.id}?locale=en`);
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive customer" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Customer details" })).toBeVisible();
  await expect(page.getByText("buyer@example.test", { exact: true })).toBeVisible();
});
