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

async function seedSavedProjects(page: Page, locale: "en" | "ar"): Promise<void> {
  await bridgeLocalTlsTermination(page);
  await page.goto(`/shipments?locale=${locale}&role=operations`);
  await page.evaluate(() => {
    const common = {
      reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee",
      quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", value: 84000,
      origin: "Mombasa", destination: "Dubai", createdAt: "2026-11-14T10:00:00.000Z",
    };
    localStorage.setItem("orb.user-projects.owner-1.v1", JSON.stringify([
      { ...common, id: "setup-project", code: "ORB-P-0041", customer: "Atlas Foods", status: "SETUP", updatedAt: "2026-11-14T10:00:00.000Z" },
      { ...common, id: "supplier-project", code: "ORB-P-0042", customer: "Cedar Roasters", supplier: "Coast Exporters", purchaseContractReference: "PC-17", status: "ACTIVE", supplierShipment: { reference: "SS-REAL-17", expectedArrival: "2026-12-02", quantity: "12" }, updatedAt: "2026-12-02T09:00:00.000Z" },
      { ...common, id: "handover-project", code: "ORB-P-0043", customer: "Nile Coffee", supplier: "Highland Cooperative", purchaseContractReference: "PC-18", status: "ACTIVE", supplierShipment: { reference: "SS-REAL-18", expectedArrival: "2026-12-02", quantity: "20" }, customerShipment: { reference: "CS-REAL-18", plannedDispatchDate: "2026-12-05", quantity: "10" }, updatedAt: "2026-12-05T11:00:00.000Z" },
    ]));
  });
  await page.reload();
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} saved shipments are a truthful responsive daily work queue`, async ({ page }) => {
    await seedSavedProjects(page, locale);
    const ar = locale === "ar";
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "الشحنات" : "Shipments" })).toBeVisible();
    await expect(page.getByText(ar ? "3 يحتاج إلى إجراء من أصل 3 مشروع محفوظ" : "3 need action · 3 saved projects", { exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("SS-REAL-17");
    await expect(page.locator("body")).toContainText("CS-REAL-18");
    await expect(page.getByRole("link", { name: ar ? "إكمال إعداد المشروع" : "Complete project setup" }).first()).toHaveAttribute("href", `/projects/setup-project/overview?locale=${locale}&role=operations#project-data`);
    await expect(page.getByRole("link", { name: ar ? "تسجيل شحنة العميل" : "Record customer shipment" }).first()).toHaveAttribute("href", `/projects/supplier-project/overview?locale=${locale}&role=operations#customer-shipment`);
    await expect(page.getByRole("link", { name: ar ? "مراجعة تفاصيل شحنة العميل" : "Review customer shipment details" }).first()).toHaveAttribute("href", `/projects/handover-project/overview?locale=${locale}&role=operations#customer-shipment`);
    await expect(page.locator("body")).not.toContainText(/Pilot Customer|Northstar|ORB-SUP-0007|DEMO|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `artifacts/product-saved-shipments-work-queue-20261115/desktop-${locale}.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const finalAction = page.locator("[class*='mobileCards'] article").last().getByRole("link");
    await finalAction.scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const action = document.querySelector("[class*='mobileCards'] article:last-child a")!.getBoundingClientRect();
      const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
      return { actionBottom: Math.round(action.bottom), navTop: Math.round(nav.top) };
    });
    expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.navTop);
    await page.screenshot({ path: `artifacts/product-saved-shipments-work-queue-20261115/mobile-${locale}.png`, fullPage: true });
  });
}

test("long saved shipment values wrap without mobile overflow", async ({ page }) => {
  await seedSavedProjects(page, "en");
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    records[0].customer = "ExtremelyLongUnbrokenCustomerNameThatMustWrapWithoutForcingTheShipmentCardBeyondTheMobileViewport";
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("shipments fails visibly when saved project storage is corrupt", async ({ page }) => {
  await bridgeLocalTlsTermination(page);
  await page.goto("/shipments?locale=en");
  await page.evaluate(() => localStorage.setItem("orb.user-projects.owner-1.v1", "not-json"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Saved shipments could not be opened" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SS-001|Pilot Customer|demo/i);
});
