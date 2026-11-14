import { expect, test, type Page } from "@playwright/test";

const key = "orb.user-projects.owner-1.v1";
async function seedProject(page: Page, status: "ACTIVE" | "CLOSED" = "ACTIVE") {
  await page.goto("/projects?locale=en");
  await page.evaluate(({ key, status }) => localStorage.setItem(key, JSON.stringify([{
    id: "saved-claim-project", code: "ORB-P-0042", customer: "Atlas Foods", supplier: "Coast Exporters",
    reference: "AF-CLAIM", contractReference: "SC-42", purchaseContractReference: "PC-42", startDate: "2026-11-14",
    commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "100", value: 100,
    origin: "Mombasa", destination: "Dubai", status,
    createdAt: "2026-11-14T10:00:00.000Z", updatedAt: "2026-11-14T11:00:00.000Z",
  }])), { key, status });
}


test("overview presents optional claims truthfully in English and Arabic and reports claim-first without expenses", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "This environment's WebKit cannot load HTTP Next.js client chunks because its proxy attempts a TLS handshake.");
  await seedProject(page);
  await page.goto("/projects/saved-claim-project/overview?locale=en");
  await expect(page.getByText("Claims (optional, when needed)", { exact: true })).toBeVisible();
  await expect(page.getByText("No claims recorded", { exact: true })).toBeVisible();
  await page.goto("/projects/saved-claim-project/overview?locale=ar");
  await expect(page.getByText("المطالبات (اختيارية عند الحاجة)", { exact: true })).toBeVisible();
  await expect(page.getByText("لا توجد مطالبات مسجلة", { exact: true })).toBeVisible();

  await page.evaluate(({ key }) => {
    const rows = JSON.parse(localStorage.getItem(key)!);
    rows[0].claims = [{ reference: "CLM-FIRST", type: "QUALITY", claimDate: "2026-11-14", claimant: "Atlas Foods", respondent: "Coast Exporters", description: "Quality issue", status: "OPEN", createdAt: "2026-11-14T10:30:00.000Z" }];
    localStorage.setItem(key, JSON.stringify(rows));
  }, { key });
  await page.goto("/projects/saved-claim-project/overview?locale=en");
  await expect(page.locator("#project-data")).toContainText("1 claim is recorded: 1 open and 0 resolved.");
  await expect(page.locator("#project-data")).not.toContainText(/no claims are recorded|No operational or financial figures/);
});

test("saved project claim supports constrained parties, exact money, persistence, keyboard use, and resolution", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "This environment's WebKit cannot load HTTP Next.js client chunks because its proxy attempts a TLS handshake.");
  await seedProject(page);
  await page.goto("/projects/saved-claim-project/claims?locale=en&role=finance-viewer");
  await expect(page.getByRole("heading", { level: 1, name: "Project claims" })).toBeVisible();
  await expect(page.getByText(/not multi-user or server-backed/i)).toBeVisible();
  // A query string is not authorization: an active saved project remains editable.
  await expect(page.getByRole("button", { name: "Save claim" })).toBeVisible();
  await expect(page.locator('[name="claimant"] option')).toHaveText(["Choose party", "Atlas Foods", "Coast Exporters"]);
  await expect(page.locator('[name="respondent"] option')).toHaveText(["Choose party", "Atlas Foods", "Coast Exporters"]);
  await expect(page.locator('[name="claimDate"]')).toHaveAttribute("min", "2026-11-14");

  await page.locator('[name="reference"]').focus();
  await page.keyboard.type("CLM-USER-1");
  await page.keyboard.press("Tab");
  await page.keyboard.type("11/15/2026");
  await page.locator('[name="type"]').selectOption("QUALITY");
  await page.locator('[name="claimant"]').selectOption("Atlas Foods");
  await page.locator('[name="respondent"]').selectOption("Coast Exporters");
  await page.locator('[name="amount"]').fill("900719925474099312345.123456");
  await page.locator('textarea[name="description"]').fill("Moisture exceeded the agreed specification");
  await page.getByRole("button", { name: "Save claim" }).click();
  await expect(page.getByText("Claim saved in this browser.")).toBeVisible();
  await expect(page.getByText("Quality · Open")).toBeVisible();
  await expect(page.getByText("900719925474099312345.123456 USD")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/QUALITY|OPEN/);

  const resolve = page.getByRole("form", { name: "Resolve claim CLM-USER-1" });
  await resolve.locator('[name="resolutionDate"]').fill("2026-11-16");
  await resolve.locator('[name="resolutionNote"]').fill("Supplier accepted a replacement lot");
  await resolve.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByText("Claim resolved with resolution details saved.")).toBeVisible();
  await expect(page.getByText("Quality · Resolved")).toBeVisible();
  await expect(page.getByText("Supplier accepted a replacement lot")).toBeVisible();
  const summary = page.getByLabel("Claim summary");
  await expect(summary.getByText("0", { exact: true })).toBeVisible();
  await expect(summary.getByText("1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Quality · Resolved")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("saved claims allow setup-complete projects without expenses and closed projects are read-only", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "This environment's WebKit cannot load HTTP Next.js client chunks because its proxy attempts a TLS handshake.");
  await seedProject(page);
  await page.goto("/projects/saved-claim-project/claims?locale=ar");
  await expect(page.getByRole("main", { name: "مطالبات المشروع" })).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "حفظ المطالبة" })).toBeVisible();
  await expect(page.getByText("سجل أول مصروف للمشروع")).toHaveCount(0);

  await seedProject(page, "CLOSED");
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  await expect(page.getByText("Read-only view")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save claim" })).toHaveCount(0);
});

test("claims route refreshes on storage events and reports tab conflicts", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "This environment's WebKit cannot load HTTP Next.js client chunks because its proxy attempts a TLS handshake.");
  await seedProject(page);
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  const second = await context.newPage();
  await second.goto("/projects/saved-claim-project/claims?locale=en");
  await second.evaluate(({ key }) => { const rows = JSON.parse(localStorage.getItem(key)!); rows[0].updatedAt = "2026-11-14T12:00:00.000Z"; localStorage.setItem(key, JSON.stringify(rows)); }, { key });
  await expect(page.getByText(/Another tab changed this register/)).toBeVisible();
});

test("claims route exposes setup, missing, and corrupt-storage states", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "This environment's WebKit cannot load HTTP Next.js client chunks because its proxy attempts a TLS handshake.");
  await seedProject(page);
  await page.evaluate(({ key }) => { const rows = JSON.parse(localStorage.getItem(key) ?? "[]"); rows[0] = { ...rows[0], status: "SETUP", supplier: undefined, purchaseContractReference: undefined }; localStorage.setItem(key, JSON.stringify(rows)); }, { key });
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  await expect(page.getByRole("heading", { name: "Complete project setup first" })).toBeVisible();
  await page.goto("/projects/missing/claims?locale=en");
  await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
  await page.evaluate(({ key }) => localStorage.setItem(key, "not-json"), { key });
  await page.goto("/projects/saved-claim-project/claims?locale=en");
  await expect(page.getByRole("heading", { name: "Claims could not be opened" })).toBeVisible();
});

test("demo claims route remains available", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Simple claims" })).toBeVisible();
  await expect(page.getByText("Sales shipment claims")).toBeVisible();
});
