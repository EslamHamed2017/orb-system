import { expect, test, type Page } from "@playwright/test";

const locales = [
  { locale: "en", direction: "ltr", today: /today/i, projects: /projects/i, approvals: /approvals/i },
  { locale: "ar", direction: "rtl", today: /اليوم/, projects: /المشاريع/, approvals: /الموافقات/ },
] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 390, height: 844 },
  { name: "minimum", width: 320, height: 720 },
] as const;

async function openShell(page: Page, locale: "ar" | "en", width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`/?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
}

for (const language of locales) {
  for (const viewport of viewports) {
    test(`${language.locale} ${language.direction} shell is equivalent at ${viewport.name}`, async ({ page }) => {
      await openShell(page, language.locale, viewport.width, viewport.height);
      await expect(page.locator("html")).toHaveAttribute("dir", language.direction);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("navigation", { name: /primary|الرئيسية/i })).toBeVisible();
      await expect(page.getByRole("link", { name: language.today })).toBeVisible();
      await expect(page.getByRole("link", { name: language.projects })).toBeVisible();
      await expect(page.getByRole("link", { name: language.approvals })).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "the page must not scroll horizontally, including at 320 CSS px").toBeLessThanOrEqual(1);
      await expect(page.locator("[data-orb-reference]").first()).toHaveCSS("unicode-bidi", /isolate|isolate-override/);

      const interactive = page.locator('a:visible, button:visible, input:visible, select:visible, [role="button"]:visible');
      const count = await interactive.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index++) {
        const box = await interactive.nth(index).boundingBox();
        if (box) expect(Math.min(box.width, box.height), `interactive element ${index} is below 48px`).toBeGreaterThanOrEqual(48);
      }
    });
  }
}

test("keyboard focus is visible, ordered, and restored after a dialog", async ({ page }) => {
  await openShell(page, "en", 390, 844);
  await page.keyboard.press("Tab");
  const first = page.locator(":focus");
  await expect(first).toBeVisible();
  expect(await first.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.getByRole("button", { name: /more/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /more/i })).toBeFocused();
});

test("reduced motion removes non-essential transitions and animations", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/?locale=en");
  const animated = await page.locator("body *").evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element);
    return (parseFloat(style.animationDuration) > 0 || parseFloat(style.transitionDuration) > 0) && style.animationName !== "none";
  }).length);
  expect(animated, "reduced-motion mode must remove non-essential motion").toBe(0);
  await context.close();
});
