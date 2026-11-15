import { expect, test, type Page } from "@playwright/test";

async function createActiveProject(page: Page, locale: "en" | "ar" = "en"): Promise<string> {
  await page.goto(`/projects/new?locale=${locale}`);
  const data = {
    customer: "Atlas Foods",
    reference: "AF-101",
    contractReference: "SC-44",
    startDate: "2026-11-14",
    commodity: locale === "ar" ? "بن" : "Coffee",
    quantity: "20",
    unit: "MT",
    currency: "USD",
    unitPrice: "4200",
    origin: locale === "ar" ? "مومباسا" : "Mombasa",
    destination: locale === "ar" ? "دبي" : "Dubai",
  };
  for (const [name, value] of Object.entries(data)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: locale === "ar" ? "حفظ وفتح المشروع" : "Save and open project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/overview/);
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("button", { name: locale === "ar" ? "إكمال إعداد المشروع" : "Complete project setup" }).click();
  await page.locator('[name="supplier"]').fill(locale === "ar" ? "مورد الساحل" : "Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: locale === "ar" ? "حفظ الإعداد" : "Save setup" }).click();
  return id;
}

test("accounts hub has a truthful empty state without fixed finance records", async ({ page }) => {
  await page.goto("/accounts?locale=en");
  await expect(page.getByRole("heading", { name: "No project finance work yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a project" })).toHaveAttribute("href", "/projects/new?locale=en");
  await expect(page.locator("body")).not.toContainText(/185,000|96,500|SINV-2026-014|PINV-2026-031|DEMO/i);
});

test("accounts hub scopes daily finance actions to the exact saved project", async ({ page }) => {
  const id = await createActiveProject(page);
  await page.goto("/accounts?locale=en");
  const project = page.locator("article").filter({ hasText: "Atlas Foods" });
  await expect(project).toContainText("AF-101");
  await expect(project).toContainText("USD");
  await expect(project.getByRole("link", { name: /Supplier invoice & payment/ })).toHaveAttribute("href", `/projects/${id}/overview?locale=en#supplier-shipment`);
  await expect(project.getByRole("link", { name: /Customer invoice & collections/ })).toHaveAttribute("href", `/projects/${id}/overview?locale=en#supplier-shipment`);
  await expect(project.getByRole("link", { name: /Project expenses/ })).toHaveAttribute("href", `/projects/${id}/expenses?locale=en`);
  await project.getByRole("link", { name: /Supplier invoice & payment/ }).click();
  await expect(page.locator("#supplier-shipment-title")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/185,000|SINV-2026-014|Independent totals/);
});


test("finance actions advance to existing anchors and closed projects never advertise unavailable tasks", async ({ page }) => {
  const id = await createActiveProject(page);
  await page.locator('[name="shipmentReference"]').fill("SS-001");
  await page.locator('[name="expectedArrival"]').fill("2026-12-02");
  await page.locator('[name="shipmentQuantity"]').fill("12");
  await page.getByRole("button", { name: "Save supplier shipment" }).click();
  await page.locator('[name="customerShipmentReference"]').fill("CS-001");
  await page.locator('[name="plannedDispatchDate"]').fill("2026-12-05");
  await page.locator('[name="customerShipmentQuantity"]').fill("10");
  await page.getByRole("button", { name: "Save customer shipment" }).click();
  await page.getByRole("button", { name: "Mark handover reviewed" }).click();
  await page.goto("/accounts?locale=en");
  const project = page.locator("article").filter({ hasText: "Atlas Foods" });
  await expect(project.getByRole("link", { name: /Supplier invoice & payment/ })).toHaveAttribute("href", `/projects/${id}/overview?locale=en#supplier-finance`);
  await expect(project.getByRole("link", { name: /Customer invoice & collections/ })).toHaveAttribute("href", `/projects/${id}/overview?locale=en#supplier-finance`);
  await project.getByRole("link", { name: /Supplier invoice & payment/ }).click();
  await expect(page.locator("#supplier-finance-title")).toBeVisible();
  await page.locator('[name="supplierInvoiceReference"]').fill("SI-001");
  await page.locator('[name="supplierInvoiceDate"]').fill("2026-12-05");
  await page.locator('[name="supplierInvoiceAmount"]').fill("50400");
  await page.getByRole("button", { name: "Save supplier invoice" }).click();
  await page.locator('[name="supplierPaymentReference"]').fill("PAY-001");
  await page.locator('[name="supplierPaymentDate"]').fill("2026-12-06");
  await page.locator('[name="supplierPaymentAmount"]').fill("50400");
  await page.getByRole("button", { name: "Save supplier payment" }).click();
  await page.goto("/accounts?locale=en");
  const customerAction = page.locator("article").filter({ hasText: "Atlas Foods" }).getByRole("link", { name: /Customer invoice & collections/ });
  await expect(customerAction).toHaveAttribute("href", `/projects/${id}/overview?locale=en#customer-finance`);
  await customerAction.click();
  await expect(page.locator("#customer-finance-title")).toHaveText("Record customer invoice");

  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    records[0] = { ...records[0], status: "CLOSED", updatedAt: new Date(new Date(records[0].updatedAt).getTime() + 1000).toISOString() };
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.goto("/accounts?locale=en");
  const closed = page.locator("article").filter({ hasText: "Atlas Foods" });
  await expect(closed.getByRole("link", { name: /Supplier invoice & payment/ })).toHaveCount(0);
  await expect(closed.getByRole("link", { name: /Customer invoice & collections/ })).toHaveCount(0);
  await expect(closed.getByRole("link", { name: /Project expenses/ })).toHaveCount(0);
  const review = closed.getByRole("link", { name: /Review closed project/ });
  await expect(review).toHaveAttribute("href", `/projects/${id}/overview?locale=en`);
  await review.click();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(`/projects/${id}/overview?locale=en`);
  await expect(page.getByRole("heading", { level: 1, name: "Atlas Foods" })).toBeVisible();
});


for (const locale of ["en", "ar"] as const) test(`${locale} finance hub is readable at desktop and mobile widths`, async ({ page }) => {
  await createActiveProject(page, locale);
  await page.goto(`/accounts?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "العمل المالي" : "Finance work" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|EXTERNAL_SEND|OUTBOUND_MANIFEST|[a-f0-9]{32}/);
  const output = "artifacts/product-finance-daily-hub-20261115";
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${output}/desktop-${locale}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
  await page.screenshot({ path: `${output}/mobile-${locale}.png`, fullPage: true });
});
