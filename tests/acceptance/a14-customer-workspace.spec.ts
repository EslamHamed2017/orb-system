import { expect, test, type Page } from "@playwright/test";

const customer = { reference: "CUS-101", nameEn: "Atlas Coffee Trading", nameAr: "أطلس لتجارة القهوة", country: "AE", contact: "Noor Ali", email: "noor@example.com", phone: "+971 50 123 4567" };
async function register(page: Page, locale: "en" | "ar") {
  const ar = locale === "ar";
  await page.getByRole("button", { name: ar ? "إضافة عميل" : "Add customer" }).click();
  await page.getByLabel(ar ? "المرجع" : "Reference").fill(customer.reference);
  await page.getByLabel(ar ? "الاسم القانوني بالإنجليزية" : "English legal name").fill(customer.nameEn);
  await page.getByLabel(ar ? "الاسم القانوني بالعربية" : "Arabic legal name").fill(customer.nameAr);
  await page.getByLabel(ar ? "رمز الدولة" : "Country code").fill(customer.country);
  await page.getByLabel(ar ? "جهة الاتصال" : "Contact name").fill(customer.contact);
  await page.getByLabel(ar ? "البريد الإلكتروني" : "Email").fill(customer.email);
  await page.getByLabel(ar ? "الهاتف" : "Phone").fill(customer.phone);
  await page.getByRole("button", { name: ar ? "حفظ العميل" : "Save customer" }).click();
}

for (const locale of ["en", "ar"] as const) test(`${locale} customer registration persists after reload`, async ({ page }) => {
  await page.goto(`/masters/customers?locale=${locale}`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await register(page, locale);
  await expect(page.getByRole("status")).toContainText(locale === "ar" ? "تم حفظ العميل" : "Customer saved");
  await expect(page.getByRole("table")).toContainText(customer.nameEn);
  await expect(page.getByRole("table")).toContainText(customer.nameAr);
  await page.reload();
  await expect(page.getByRole("table")).toContainText(customer.reference);
});

for (const locale of ["en", "ar"] as const) test(`mobile ${locale} customer cards avoid overflow and bottom navigation overlap`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/masters/customers?locale=${locale}`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await register(page, locale);
  await expect(page.getByRole("table")).toContainText(customer.email);
  await expect(page.getByRole("columnheader")).toHaveCount(5);
  const headerState = await page.locator("thead").evaluate((header) => ({ display: getComputedStyle(header).display, hidden: (header as HTMLElement).hidden, ariaHidden: header.getAttribute("aria-hidden") }));
  expect(headerState.display).not.toBe("none");
  expect(headerState).toMatchObject({ hidden: false, ariaHidden: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => { const main = document.querySelector(".orb-main")!.getBoundingClientRect(); const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect(); return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) }; });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
});

test("duplicate customer reference is rejected and the original survives", async ({ page }) => {
  await page.goto("/masters/customers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload();
  await register(page, "en");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Reference").fill(" cus-101 ");
  await page.getByLabel("English legal name").fill("Different Company"); await page.getByLabel("Arabic legal name").fill("شركة مختلفة"); await page.getByLabel("Country code").fill("AE"); await page.getByLabel("Contact name").fill("Other Contact"); await page.getByLabel("Email").fill("other@example.com"); await page.getByLabel("Phone").fill("+971 50 765 4321");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("That customer reference is already in use.", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
});

test("corrupt customer storage is explicit and never substitutes fixtures", async ({ page }) => {
  await page.goto("/masters/customers?locale=en"); await page.evaluate(() => localStorage.setItem("orb.browser-customers.v1", "not-json")); await page.reload();
  await expect(page.getByText("Saved customer data is corrupt", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Northstar Roasters");
  await expect(page.getByRole("button", { name: "Add customer" })).toBeDisabled();
});

test("saved customer can be edited, archived, and reactivated without deletion", async ({ page }) => {
  await page.goto("/masters/customers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload(); await register(page, "en");
  await page.getByRole("button", { name: "Edit" }).click(); await expect(page.getByLabel("Reference")).toHaveAttribute("readonly", "");
  await page.getByLabel("Contact name").fill("Mona Saleh"); await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByRole("table")).toContainText("Mona Saleh");
  await page.getByRole("button", { name: "Archive" }).click(); await expect(page.getByRole("table")).toContainText("Archived");
  await page.getByRole("button", { name: "Reactivate" }).click(); await expect(page.getByRole("table")).toContainText("Active");
});

test("failed lifecycle write is announced outside the closed registration details", async ({ page }) => {
  await page.goto("/masters/customers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload(); await register(page, "en");
  const registration = page.locator("#customer-registration");
  await registration.evaluate((details: HTMLDetailsElement) => { details.open = false; });
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("simulated lifecycle write failure"); }; });
  await page.getByRole("button", { name: "Archive" }).click();
  const feedback = page.getByText("Customer data could not be saved in this browser.", { exact: true });
  await expect(feedback).toHaveAttribute("role", "alert");
  await expect(feedback).toHaveText("Customer data could not be saved in this browser.");
  await expect(feedback).toBeVisible();
  await expect(registration).not.toHaveAttribute("open", "");
  await expect(feedback).toBeFocused();
  await expect(page.getByRole("table")).toContainText("Active");
});

test("customer directory synchronizes a save from another tab", async ({ context, page }) => {
  const other = await context.newPage(); await page.goto("/masters/customers?locale=en"); await page.evaluate(() => localStorage.clear()); await page.reload(); await other.goto("/masters/customers?locale=en");
  await register(other, "en"); await expect(page.getByRole("table")).toContainText(customer.reference); await other.close();
});
