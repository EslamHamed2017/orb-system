import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} organization and print settings expose audited bilingual controls`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/settings?locale=${locale}`);
    const panel = page.locator("#organization-print-settings");
    await expect(panel.getByRole("heading", { level: 2, name: ar ? "المؤسسة والطباعة" : "Organization and print" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(panel.getByRole("textbox", { name: ar ? "الاسم القانوني بالإنجليزية" : "English legal name" })).toHaveValue("ORB Trading");
    await expect(panel.getByRole("textbox", { name: ar ? "الاسم القانوني بالعربية" : "Arabic legal name" })).toHaveValue("أورب للتجارة");
    await expect(panel.getByRole("combobox", { name: ar ? "اللغة الافتراضية" : "Default language" })).toHaveValue("en");
    await expect(panel.getByRole("combobox", { name: ar ? "المنطقة الزمنية" : "Time zone" })).toHaveValue("Asia/Dubai");
    await expect(panel.getByRole("checkbox", { name: ar ? "إظهار شعار ORB" : "Show ORB logo" })).toBeChecked();
    await expect(panel.getByRole("textbox", { name: ar ? "سبب التغيير" : "Change reason" })).toHaveAttribute("minlength", "8");
    await expect(panel.getByRole("button", { name: ar ? "حفظ المؤسسة والطباعة" : "Save organization and print" })).toBeEnabled();
  });
}

test("organization and print settings disable mutation controls without owner access", async ({ page }) => {
  await page.goto("/settings?locale=en&role=operations");
  const panel = page.locator("#organization-print-settings");
  await expect(panel.getByRole("alert")).toContainText("do not have permission");
  await expect.poll(() => panel.locator("input, select, textarea, button").evaluateAll((items) => items.length === 9 && items.every((item) => (item as HTMLInputElement).disabled))).toBe(true);
});
