import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} numbering settings expose immutable reference previews and audited owner controls`, async ({ page }) => {
    const ar = locale === "ar";
    await page.goto(`/settings?locale=${locale}`);
    const panel = page.locator("#numbering");
    await expect(panel.getByRole("heading", { level: 2, name: ar ? "الترقيم والمراجع" : "Numbering and references" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(panel.getByRole("textbox", { name: ar ? /^عقد البيع/ : /^Sales contract/ })).toHaveValue("SC");
    await expect(panel.getByText(ar ? "مثال مرجعي: SC-2026-000001" : "Reference preview: SC-2026-000001", { exact: true })).toBeVisible();
    await expect(panel.getByText(ar ? "تنطبق التغييرات على المراجع الجديدة فقط" : "Changes apply only to new references", { exact: false })).toBeVisible();
    await expect(panel.getByRole("textbox", { name: ar ? "سبب التغيير" : "Change reason" })).toHaveAttribute("minlength", "8");
    await expect(panel.getByRole("button", { name: ar ? "حفظ بادئات المراجع" : "Save reference prefixes" })).toBeEnabled();
    await expect(panel.locator('form[data-operation-id="updateSettings"]')).toBeVisible();
  });
}

test("numbering settings disable every mutation control without owner access", async ({ page }) => {
  await page.goto("/settings?locale=en&role=operations");
  const panel = page.locator("#numbering");
  await expect(panel.getByRole("alert")).toContainText("do not have permission");
  await expect.poll(() => panel.locator("input, textarea, button").evaluateAll((items) => items.length === 6 && items.every((item) => (item as HTMLInputElement).disabled))).toBe(true);
});
