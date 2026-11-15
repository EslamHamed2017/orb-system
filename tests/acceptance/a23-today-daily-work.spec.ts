import { expect, test, type Page } from "@playwright/test";

async function bridgeLocalTlsTermination(page: Page): Promise<void> {
  const local = /^(?:http|https):\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//;
  await page.route(local, async (route) => {
    const request = route.request();
    if (request.resourceType() === "document" && request.url().startsWith("http:")) {
      const response = await route.fetch();
      const headers = response.headers();
      headers["content-security-policy"] = headers["content-security-policy"]?.replace(/;?\s*upgrade-insecure-requests/g, "") ?? "";
      await route.fulfill({ response, headers });
      return;
    }
    if (request.url().startsWith("https:")) {
      const response = await page.request.fetch(request.url().replace(/^https:/, "http:"), {
        method: request.method(), headers: request.headers(), data: request.postDataBuffer() ?? undefined,
      });
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
}

async function createProject(page: Page, locale: "en" | "ar"): Promise<void> {
  await bridgeLocalTlsTermination(page);
  await page.goto(`/?locale=${locale}`);
  const now = "2026-11-15T04:30:00.000Z";
  await page.evaluate(({ customer, now }) => {
    localStorage.setItem("orb.user-projects.owner-1.v1", JSON.stringify([{
      id: "today-project", code: "ORB-P-0001", customer, reference: "AF-101", contractReference: "SC-44",
      startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD",
      unitPrice: "4200", value: 84000, origin: "Mombasa", destination: "Dubai", status: "SETUP",
      createdAt: now, updatedAt: now,
    }]));
  }, { customer: locale === "ar" ? "شركة أطلس" : "Atlas Foods", now });
  await page.reload();
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} Today turns saved work into a specific direct action`, async ({ page, browserName }) => {
    await createProject(page, locale);
    await page.goto(`/?locale=${locale}`);

    await expect(page.getByText(locale === "ar"
      ? "ابدأ بالخطوة المطلوبة التالية لكل مشروع يحتاج إلى عمل."
      : "Start with the next required step for every project that needs work.", { exact: true })).toBeVisible();
    await expect(page.getByText(locale === "ar" ? "مشروع واحد يحتاج إلى إجراء" : "1 project needs action", { exact: true })).toBeVisible();
    await expect(page.getByText(locale === "ar" ? "الإعداد" : "Setup", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: locale === "ar" ? "إكمال الإعداد" : "Complete setup" })).toHaveAttribute("href", new RegExp(`/overview\\?locale=${locale}#project-data$`));
    await expect(page.getByRole("link", { name: locale === "ar" ? "عرض المشروع" : "View project" })).toHaveAttribute("href", new RegExp(`/overview\\?locale=${locale}$`));
    await expect(page.locator("body")).not.toContainText(/bounded flow|المسار المحدود|Open action|فتح الإجراء/);
    if (browserName === "chromium") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: `artifacts/product-today-priority-flow-20261115/desktop-${locale}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (browserName === "chromium") await page.screenshot({ path: `artifacts/product-today-priority-flow-20261115/mobile-${locale}.png`, fullPage: true });
  });
}

test("Today action cards remain clear above mobile navigation", async ({ page }) => {
  await createProject(page, "en");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?locale=en");
  await expect(page.getByRole("link", { name: "Complete setup" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="today-action"]')!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { cardBottom: Math.round(card.bottom), navTop: Math.round(nav.top) };
  });
  expect(geometry.cardBottom).toBeLessThanOrEqual(geometry.navTop);
});
