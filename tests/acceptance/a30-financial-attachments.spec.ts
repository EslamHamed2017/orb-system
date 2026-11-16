import { expect, test } from "@playwright/test";

const cases = [
  { path: "/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201&locale=en", subject: "SALES_INVOICE", id: "00000000-0000-7000-8000-000000000277", title: "Attachments" },
  { path: "/accounts/supplier-invoices?projectId=project-1&locale=ar", subject: "SUPPLIER_INVOICE", id: "019a5f9b-7c00-7000-8000-000000001101", title: "مرفقات" },
  { path: "/accounts/collections?projectId=project-1&locale=en", subject: "MONEY_MOVEMENT", id: "019a5f9b-7c00-7000-8000-000000001201", title: "Attachments" },
  { path: "/accounts/supplier-payments?projectId=project-1&locale=ar", subject: "MONEY_MOVEMENT", id: "019a5f9b-7c00-7000-8000-000000001203", title: "مرفقات" },
] as const;

for (const item of cases) {
  test(`${item.subject} ${item.id} transaction exposes its directly scoped attachment panel`, async ({ page }) => {
    await page.goto(item.path);
    const panel = page.locator(`section[data-backend-endpoint*=\"subjectType=${item.subject}\"][data-backend-endpoint*=\"subjectId=${item.id}\"]`);
    const unavailable = page.getByRole("status").filter({ hasText: "no sample records are shown" });
    if (item.subject === "SALES_INVOICE") await expect(panel.or(unavailable)).toBeVisible();
    if (item.subject === "SALES_INVOICE" && await unavailable.isVisible()) {
      await expect(panel).toHaveCount(0);
    } else {
      await expect(panel).toHaveCount(1);
      await expect(panel.getByRole("heading", { name: item.title })).toBeVisible();
      const expectedUploadControls = item.subject === "SALES_INVOICE" ? 0 : 1;
      await expect(panel.locator(`input[name=\"subjectType\"][value=\"${item.subject}\"]`)).toHaveCount(expectedUploadControls);
      await expect(panel.locator(`input[name=\"subjectId\"][value=\"${item.id}\"]`)).toHaveCount(expectedUploadControls);
      await expect(panel.getByRole("button", { name: /Upload and verify|رفع والتحقق/ })).toHaveCount(expectedUploadControls);
      if (item.subject === "SALES_INVOICE") await expect(panel.getByText(/Read-only attachments/)).toBeVisible();
    }
  });
}

test("role query parameters cannot grant sales invoice attachment uploads", async ({ page }) => {
  await page.goto("/accounts/sales-invoices?projectId=00000000-0000-7000-8000-000000000201&locale=en&role=operations");
  const panel = page.locator("section[data-backend-endpoint*=\"subjectType=SALES_INVOICE\"]");
  const unavailable = page.getByRole("status").filter({ hasText: "no sample records are shown" });
  await expect(panel.or(unavailable)).toBeVisible();
  if (await unavailable.isVisible()) await expect(panel).toHaveCount(0);
  else {
    await expect(panel.getByText(/Read-only attachments/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Upload and verify" })).toHaveCount(0);
  }
});
