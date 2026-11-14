import { expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, locale: "en" | "ar" = "en"): Promise<string> {
  await page.goto(`/projects/new?locale=${locale}`);
  const data = { customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" };
  for (const [name, value] of Object.entries(data)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: locale === "ar" ? "حفظ وفتح المشروع" : "Save and open project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/overview/);
  return new URL(page.url()).pathname;
}

test("empty Today and Projects disclose browser-only storage and never show fixed projects", async ({ page }) => {
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "No actions yet" })).toBeVisible();
  await expect(page.getByText("One next action for each saved project that needs work in this bounded flow.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("No sample project is inserted into your personal list");
  await page.goto("/projects?locale=en");
  await expect(page.getByRole("heading", { name: "No saved projects" })).toBeVisible();
  await expect(page.locator("body")).toContainText("saved in this browser only");
  await expect(page.locator("body")).not.toContainText(/Pilot Customer|ORB-P-0001/);
});

test("creation persists exact fields, opens the exact detail, and Today has one direct action", async ({ page }) => {
  const detailPath = await createProject(page);
  await expect(page.getByRole("heading", { level: 1, name: "Atlas Foods" })).toBeVisible();
  await expect(page.locator("body")).toContainText("AF-101");
  await expect(page.locator("body")).toContainText("SC-44");
  await expect(page.getByText("Not started", { exact: true })).toHaveCount(7);
  await expect(page.locator('#lifecycle a[href*="/contracts"], #lifecycle a[href*="/shipments"], #lifecycle a[href*="/money"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Pilot Customer|estimated total|actual margin/i);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(detailPath));
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "Complete project setup" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open action" })).toHaveAttribute("href", /\/overview\?locale=en#project-data$/);
  await page.goto(`${detailPath}?locale=en`);
  await expect(page.getByRole("button", { name: "Complete project setup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Complete project setup" })).toHaveCount(0);
});

test("corrupt browser storage shows an error instead of pretending the register is empty", async ({ page }) => {
  await page.goto("/projects?locale=en");
  await page.evaluate(() => localStorage.setItem("orb.user-projects.owner-1.v1", "not-json"));
  await page.reload();
  await expect(page.getByText("Projects could not be opened", { exact: true })).toBeVisible();
});

test("project search works and cards reflow above mobile navigation", async ({ page }) => {
  await createProject(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects?locale=en");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("Atlas");
  await expect(page.getByRole("heading", { name: "Atlas Foods" })).toBeVisible();
  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const bottom = page.locator('[data-navigation="bottom"]');
  await expect(bottom).toBeVisible();
  const shellGeometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(shellGeometry.mainBottom).toBeLessThanOrEqual(shellGeometry.navTop);
});

for (const locale of ["en", "ar"] as const) test(`${locale} bounded flow uses route direction and business copy`, async ({ page }) => {
  await createProject(page, locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.locator("body")).toContainText(locale === "ar" ? "مسار دورة العمل" : "Lifecycle tasks");
  await expect(page.locator("body")).not.toContainText(/SETUP|ACTIVE|CLOSED|[a-f0-9]{32}/);
});


test("project setup can be completed and advances the persisted Today action", async ({ page }) => {
  const detailPath = await createProject(page);
  await page.getByRole("button", { name: "Complete project setup" }).click();
  await expect(page.locator("#setup-editor-title")).toHaveText("Complete project setup");
  await expect(page.locator('[name="setupCustomer"]')).toHaveValue("Atlas Foods");
  await expect(page.locator('[name="salesContractReference"]')).toHaveValue("SC-44");
  await page.locator('[name="setupCustomer"]').fill("Atlas Coffee Trading");
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atlas Coffee Trading" })).toBeVisible();
  await expect(page.locator("#project-data")).toContainText("Coast Exporters");
  await expect(page.locator("#project-data")).toContainText("PC-17");
  await expect(page.locator("#lifecycle")).toContainText("Setup complete");
  await page.reload();
  await expect(page).toHaveURL(new RegExp(detailPath));
  await expect(page.getByRole("heading", { name: "Atlas Coffee Trading" })).toBeVisible();
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "Record supplier shipment" })).toBeVisible();
});


test("stale setup form cannot overwrite a project closed in another session", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Complete project setup" }).click();
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    const updatedAt = new Date(new Date(records[0].updatedAt).getTime() + 1_000).toISOString();
    records[0] = { ...records[0], status: "CLOSED", customer: "Newer customer", updatedAt };
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Setup could not be saved");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("orb.user-projects.owner-1.v1") ?? "[]")[0]);
  expect(saved.status).toBe("CLOSED");
  expect(saved.customer).toBe("Newer customer");
});


test("active project records supplier and customer shipments and Today advances truthfully", async ({ page }) => {
  const detailPath = await createProject(page);
  await page.getByRole("button", { name: "Complete project setup" }).click();
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.locator("#supplier-shipment-title")).toHaveText("Record supplier shipment");
  await page.locator('[name="shipmentReference"]').fill("SS-001");
  await page.locator('[name="expectedArrival"]').fill("2026-12-02");
  await page.locator('[name="shipmentQuantity"]').fill("12");
  await page.getByRole("button", { name: "Save supplier shipment" }).click();
  await expect(page.locator("#supplier-shipment").getByText("Saved shipment", { exact: true })).toBeVisible();
  await expect(page.locator("#supplier-shipment").getByText("Next operational step", { exact: true })).toHaveCount(0);
  await expect(page.locator("#supplier-shipment")).toContainText("SS-001");
  await expect(page.locator("#supplier-shipment")).toContainText("12 MT");
  await expect(page.locator("#customer-shipment-title")).toHaveText("Record customer shipment");
  await page.locator('[name="customerShipmentReference"]').fill("CS-001");
  await page.locator('[name="plannedDispatchDate"]').fill("2026-12-05");
  await page.locator('[name="customerShipmentQuantity"]').fill("10");
  await page.getByRole("button", { name: "Save customer shipment" }).click();
  await expect(page.locator("#customer-shipment")).toContainText("CS-001");
  await expect(page.locator("#supplier-shipment")).toContainText("The supplier shipment is saved with the recorded customer shipment in this bounded flow.");
  await expect(page.locator("#customer-shipment")).toContainText("10 MT");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page).toHaveURL(new RegExp(detailPath));
  await expect(page.locator("#supplier-shipment")).toContainText("SS-001");
  await expect(page.locator("#customer-shipment")).toContainText("CS-001");
  const mobileGeometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(mobileGeometry.mainBottom).toBeLessThanOrEqual(mobileGeometry.navTop);
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "Review shipment handover" })).toBeVisible();
  await expect(page.locator("body")).toContainText("CS-001");
  await page.getByRole("link", { name: "Open action" }).click();
  await expect(page.locator("#customer-shipment")).toContainText("Data exists only in this browser. It is not synchronized or backed up. Clearing browser data removes it.");
  await expect(page.locator("#customer-shipment").getByText("Review step", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark handover reviewed" }).click();
  await expect(page.getByRole("heading", { name: "Bounded flow complete" })).toBeVisible();
  await expect(page.locator("#customer-shipment").getByText("Bounded flow complete", { exact: true })).toBeVisible();
  await expect(page.locator("#supplier-shipment")).toContainText("The recorded supplier shipment remains part of the completed bounded flow.");
  await expect(page.locator("body")).not.toContainText(/next invoice|record payment/i);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bounded flow complete" })).toBeVisible();
  await page.goto("/?locale=en");
  await expect(page.getByRole("heading", { name: "No actions due" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No actions yet" })).toHaveCount(0);
  await page.goto(`${detailPath}?locale=en`);
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    const updatedAt = new Date(new Date(records[0].updatedAt).getTime() + 1_000).toISOString();
    records[0] = { ...records[0], status: "CLOSED", updatedAt };
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Atlas Foods" })).toBeVisible();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project could not be opened" })).toHaveCount(0);
});

test("stale customer shipment form cannot overwrite a newer stored shipment", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Complete project setup" }).click();
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "Save setup" }).click();
  await page.locator('[name="shipmentReference"]').fill("SS-001");
  await page.locator('[name="expectedArrival"]').fill("2026-12-02");
  await page.locator('[name="shipmentQuantity"]').fill("12");
  await page.getByRole("button", { name: "Save supplier shipment" }).click();
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    const updatedAt = new Date(new Date(records[0].updatedAt).getTime() + 1_000).toISOString();
    records[0] = { ...records[0], customerShipment: { reference: "CS-NEWER", plannedDispatchDate: "2026-12-06", quantity: "8" }, updatedAt };
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.locator('[name="customerShipmentReference"]').fill("CS-STALE");
  await page.locator('[name="plannedDispatchDate"]').fill("2026-12-05");
  await page.locator('[name="customerShipmentQuantity"]').fill("10");
  await page.getByRole("button", { name: "Save customer shipment" }).click();
  await expect(page.locator("#customer-shipment").getByRole("alert")).toContainText("Customer shipment could not be saved");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("orb.user-projects.owner-1.v1") ?? "[]")[0]);
  expect(saved.customerShipment.reference).toBe("CS-NEWER");
});


test("stale handover review cannot overwrite a project changed in another session", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Complete project setup" }).click();
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "Save setup" }).click();
  await page.locator('[name="shipmentReference"]').fill("SS-001");
  await page.locator('[name="expectedArrival"]').fill("2026-12-02");
  await page.locator('[name="shipmentQuantity"]').fill("12");
  await page.getByRole("button", { name: "Save supplier shipment" }).click();
  await page.locator('[name="customerShipmentReference"]').fill("CS-001");
  await page.locator('[name="plannedDispatchDate"]').fill("2026-12-05");
  await page.locator('[name="customerShipmentQuantity"]').fill("10");
  await page.getByRole("button", { name: "Save customer shipment" }).click();
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    const updatedAt = new Date(new Date(records[0].updatedAt).getTime() + 1_000).toISOString();
    records[0] = { ...records[0], status: "CLOSED", updatedAt };
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.getByRole("button", { name: "Mark handover reviewed" }).click();
  await expect(page.locator("#customer-shipment").getByRole("alert")).toContainText("Handover review could not be saved");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("orb.user-projects.owner-1.v1") ?? "[]")[0]);
  expect(saved.status).toBe("CLOSED");
  expect(saved.customerShipmentReviewedAt).toBeUndefined();
});

test("Arabic shipment actions disclose local-only risk and complete in RTL", async ({ page }) => {
  await createProject(page, "ar");
  await page.getByRole("button", { name: "إكمال إعداد المشروع" }).click();
  await page.locator('[name="supplier"]').fill("Coast Exporters");
  await page.locator('[name="purchaseContractReference"]').fill("PC-17");
  await page.getByRole("button", { name: "حفظ الإعداد" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#supplier-shipment")).toContainText("البيانات موجودة في هذا المتصفح فقط، ولا تتم مزامنتها أو نسخها احتياطياً، ومسح بيانات المتصفح يحذفها.");
  await page.locator('[name="shipmentReference"]').fill("SS-AR-001");
  await page.locator('[name="expectedArrival"]').fill("2026-12-02");
  await page.locator('[name="shipmentQuantity"]').fill("12");
  await page.getByRole("button", { name: "حفظ شحنة المورد" }).click();
  await expect(page.locator("#supplier-shipment").getByText("شحنة محفوظة", { exact: true })).toBeVisible();
  await page.locator('[name="customerShipmentReference"]').fill("CS-AR-001");
  await page.locator('[name="plannedDispatchDate"]').fill("2026-12-05");
  await page.locator('[name="customerShipmentQuantity"]').fill("10");
  await page.getByRole("button", { name: "حفظ شحنة العميل" }).click();
  await expect(page.locator("#customer-shipment").getByText("خطوة المراجعة", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تأكيد مراجعة التسليم" }).click();
  await expect(page.getByRole("heading", { name: "اكتمل المسار المحدود" })).toBeVisible();
  await page.goto("/?locale=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("إجراء تالٍ واحد لكل مشروع محفوظ يحتاج إلى عمل ضمن هذا المسار المحدود.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "لا توجد إجراءات مستحقة" })).toBeVisible();
});
