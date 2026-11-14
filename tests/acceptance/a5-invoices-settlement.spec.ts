import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { heading: "Money", invoice: "Supplier invoice", payment: "Supplier invoice and payment", settlement: "Sales settlement", movement: "Record money movement", allocation: "Allocate movement", reversal: "Reverse allocation", available: "Available", outstanding: "Target outstanding", after: "Post-allocation balance", submit: "Submit invoice for approval", confirm: "Confirm approved invoice", cancel: "Cancel unallocated invoice" },
  ar: { heading: "الأموال", invoice: "فاتورة مورد", payment: "فاتورة مورد والدفع", settlement: "تسوية شحنة البيع", movement: "تسجيل حركة مالية", allocation: "تخصيص الحركة", reversal: "عكس التخصيص", available: "المتاح", outstanding: "المستحق على الهدف", after: "الرصيد بعد التخصيص", submit: "إرسال الفاتورة للموافقة", confirm: "تأكيد الفاتورة المعتمدة", cancel: "إلغاء الفاتورة غير المخصصة" },
} as const;

function region(page: Page, name: string): Locator {
  return page.getByRole("region", { name });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} money workspace exposes invoice, advance and exact allocation controls`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/money?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();

    const invoice = region(page, text.invoice);
    await expect(invoice.getByLabel(locale === "ar" ? "مرجع الفاتورة التجارية" : "Invoice reference")).toBeVisible();
    await expect(invoice.getByLabel(locale === "ar" ? "أصل الفاتورة التجارية" : "Commercial Invoice original")).toBeVisible();
    await expect(invoice.getByRole("button", { name: text.submit })).toBeVisible();
    await expect(invoice.getByRole("button", { name: text.confirm })).toBeVisible();
    await expect(invoice.getByRole("button", { name: text.cancel })).toBeVisible();

    const movement = region(page, text.movement);
    await expect(movement.getByLabel(locale === "ar" ? "نوع الحركة" : "Movement kind")).toContainText(locale === "ar" ? "دفعة مقدمة للمورد" : "Supplier advance");
    await expect(movement.getByLabel(locale === "ar" ? "المبلغ" : "Amount")).toBeVisible();
    await expect(movement.getByLabel(locale === "ar" ? "العملة" : "Currency")).toHaveValue("USD");

    const allocation = region(page, text.allocation);
    await expect(allocation.getByText(text.available, { exact: true })).toBeVisible();
    await expect(allocation.getByText(text.outstanding, { exact: true })).toBeVisible();
    await expect(allocation.getByText(text.after, { exact: true })).toBeVisible();
    await expect(allocation.getByText("USD 10,000.00", { exact: true })).toBeVisible();
    await expect(allocation.getByText("USD 7,500.00", { exact: true })).toBeVisible();
    await expect(allocation.getByText("USD 5,000.00", { exact: true })).toBeVisible();
  });
}

test("partial and split allocations remain immutable and reconcile to zero variance", async ({ page }) => {
  await page.goto("/projects/demo/money?locale=en&demoState=split");
  const allocation = region(page, /allocate movement/i);
  await expect(allocation.getByRole("table", { name: /allocation history/i }).locator("tbody tr")).toHaveCount(2);
  await expect(allocation.getByText("ALLOC-0001", { exact: true })).toBeVisible();
  await expect(allocation.getByText("ALLOC-0002", { exact: true })).toBeVisible();
  await expect(allocation).not.toContainText(/edit allocation|delete allocation/i);
  await expect(page.getByRole("status").filter({ hasText: /zero variance/i })).toContainText(/USD 0.00/);
});

test("reasoned reversal previews balances and displays immutable compensating rows", async ({ page }) => {
  await page.goto("/projects/demo/money?locale=en&demoState=reversed");
  const reversal = region(page, /reverse allocation/i);
  await expect(reversal.getByLabel(/active allocation/i)).toHaveValue("ALLOC-0001");
  await expect(reversal.getByLabel(/reversal reason/i)).toBeVisible();
  await expect(reversal.getByText(/movement available after reversal.*USD 7,500.00/i)).toBeVisible();
  await expect(reversal.getByText(/invoice outstanding after reversal.*USD 7,500.00/i)).toBeVisible();
  await expect(reversal.getByText(/final close reopened/i)).toBeVisible();
  await expect(reversal.getByRole("table", { name: /reversal history/i }).locator("tbody tr")).toHaveCount(2);
  const history = reversal.getByRole("table", { name: /reversal history/i });
  await expect(history.getByText("ALLOC-0001", { exact: true })).toBeVisible();
  await expect(history.getByText("REV-0001", { exact: true })).toBeVisible();
});

test("refund and invalid allocation states fail safely without destructive controls", async ({ page }) => {
  await page.goto("/projects/demo/money?locale=en&demoState=invalid-allocation");
  const error = page.getByRole("alert").filter({ hasText: /allocation rejected/i });
  await expect(error).toContainText(/same party and currency/i);
  await expect(error).toContainText(/no balance changed/i);
  await expect(page.locator("body")).not.toContainText(/edit allocation|delete allocation|bank import|automatic allocation/i);

  await page.goto("/projects/demo/money?locale=en&demoState=refund");
  await expect(region(page, /record money movement/i).locator("strong").filter({ hasText: /customer refund/i })).toBeVisible();
  await expect(page.getByText(/compensating movement/i)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /zero variance/i })).toContainText(/USD 0.00/);
});

test("stable shipment panels expose finance facts without integrating shipment pages", async ({ page }) => {
  await page.goto("/projects/demo/money?locale=en");
  await expect(region(page, /supplier invoice and payment/i).getByText(/ORB-SUP-0007/)).toBeVisible();
  await expect(region(page, /sales settlement/i).getByText(/ORB-SAL-0007/)).toBeVisible();
  await expect(region(page, /supplier invoice and payment/i).getByText(/outstanding.*USD 7,500.00/i)).toBeVisible();
  await expect(region(page, /sales settlement/i).getByText(/received.*USD 4,000.00/i)).toBeVisible();
});
