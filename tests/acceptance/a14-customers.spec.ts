import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} customer directory is honest, empty, and fixture-free`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/masters/customers?locale=${locale}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: ar ? "العملاء" : "Customers" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "محفوظ في ملف هذا المتصفح" : "Saved in this browser profile")).toBeVisible();
    await expect(page.getByText(ar ? /لا تتم مزامنته أو نسخه احتياطياً/ : /not synchronized or backed up/)).toBeVisible();
    await expect(page.getByRole("heading", { name: ar ? "لم يُسجل أي عميل بعد" : "No customers registered yet" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Northstar Roasters");
  });
}

test("customer filters preserve locale and optional role", async ({ page }) => {
  await page.goto("/masters/customers?locale=ar&role=finance&q=Atlas&status=ACTIVE");
  await expect(page.locator('input[name="locale"]')).toHaveValue("ar");
  await expect(page.locator('input[name="role"]')).toHaveValue("finance");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await expect(page).toHaveURL(/locale=ar/);
  await expect(page).toHaveURL(/role=finance/);
  await expect(page.getByRole("link", { name: "مسح المرشحات" })).toHaveAttribute("href", /locale=ar.*role=finance/);
});

test("every customer lifecycle mutation is permission-aware", async ({ page }) => {
  const record = [
    { id: "customer-permission-active", reference: "CUS-900", legalNameEn: "Permission Customer", legalNameAr: "عميل الصلاحيات", countryCode: "ET", contactName: "Hana", email: "hana@example.com", phone: "+251 900", active: true, projectCount: 0, openInvoiceCount: 0 },
    { id: "customer-permission-archived", reference: "CUS-901", legalNameEn: "Archived Customer", legalNameAr: "عميل مؤرشف", countryCode: "AE", contactName: "Noor", email: "noor@example.com", phone: "+971 500", active: false, projectCount: 0, openInvoiceCount: 0 },
  ];
  await page.goto("/masters/customers?locale=en&role=finance");
  await page.evaluate((items) => localStorage.setItem("orb.browser-customers.v1", JSON.stringify(items)), record);
  await page.reload();
  await expect(page.getByRole("button", { name: "Add customer" })).toBeDisabled();
  const editButtons = page.getByRole("button", { name: "Edit" });
  await expect(editButtons).toHaveCount(2);
  await expect(editButtons.first()).toBeDisabled();
  await expect(editButtons.last()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Archive" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeDisabled();
  await page.locator("#customer-registration > summary").click();
  await expect(page.getByRole("button", { name: "Save customer" })).toBeDisabled();
});
