import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: { heading: "Document workspace", generation: "Generation status", comparison: "Shared field comparison", documents: "Sales shipment documents", manifest: "Exact manifest preview", snapshots: "Approved and sent comparison", attempts: "Send attempts", send: "Send now", revise: "Revise manifest", cancel: "Cancel manifest" },
  ar: { heading: "مساحة المستند", generation: "حالة الإنشاء", comparison: "مقارنة الحقول المشتركة", documents: "مستندات شحنة البيع", manifest: "معاينة بيان الإرسال الدقيقة", snapshots: "مقارنة المعتمد والمرسل", attempts: "محاولات الإرسال", send: "إرسال الآن", revise: "مراجعة بيان الإرسال", cancel: "إلغاء بيان الإرسال" },
} as const;

function region(page: Page, name: string | RegExp): Locator {
  return page.getByRole("region", { name });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} workspace exposes exact dataset generation, zero shared mismatch and lifecycle controls`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/documents/demo?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();

    const generation = region(page, text.generation);
    await expect(generation.getByText("ORB-SAL-0007", { exact: true })).toBeVisible();
    await expect(generation.getByText(locale === "ar" ? "جاهز" : "Ready", { exact: true })).toBeVisible();
    await expect(generation.getByLabel(locale === "ar" ? "نوع المستند" : "Document kind")).toHaveValue("CINV");
    await expect(generation.getByLabel(locale === "ar" ? "لغة المستند" : "Document language")).toHaveValue("BILINGUAL");
    await expect(generation.getByRole("link", { name: locale === "ar" ? /معاينة المخرجات/ : /preview output/i })).toBeVisible();

    const comparison = region(page, text.comparison);
    await expect(comparison.getByRole("status")).toContainText(locale === "ar" ? "صفر اختلاف" : "Zero mismatch");
    await expect(comparison.getByRole("table").locator("tbody tr")).toHaveCount(4);
    await expect(comparison).toContainText("CINV");
    await expect(comparison).toContainText("Packing List");

    const documents = region(page, text.documents);
    await expect(documents.getByText("DOC-0007-R2", { exact: true })).toBeVisible();
    await expect(documents.getByRole("button", { name: locale === "ar" ? /إرسال المستند للموافقة/ : /submit document for approval/i })).toBeVisible();
    await expect(documents.getByLabel(locale === "ar" ? "سبب المراجعة أو الإلغاء" : "Revision or cancellation reason")).toBeVisible();
  });
}

test("approved exact manifest is read-only and Send now accepts no editable payload", async ({ page }) => {
  await page.goto("/documents/demo?locale=en");
  const preview = region(page, /exact manifest preview/i);
  await expect(preview.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(preview.getByText("ops@example.test", { exact: true })).toBeVisible();
  await expect(preview.getByText("finance@example.test", { exact: true })).toBeVisible();
  await expect(preview.getByText("ORB-SAL-0007 commercial documents", { exact: true })).toBeVisible();
  await expect(preview.getByText("cinv-ORB-SAL-0007.pdf", { exact: true })).toBeVisible();
  await expect(preview.getByText("packing-list-ORB-SAL-0007.pdf", { exact: true })).toBeVisible();
  await expect(preview.getByText(/64 bytes/)).toBeVisible();
  await expect(preview.locator("input, textarea, select")).toHaveCount(0);
  await expect(preview.getByRole("button", { name: /send now/i })).toBeVisible();
  await expect(preview.getByRole("button", { name: /revise manifest/i })).toBeVisible();
  await expect(preview.getByRole("button", { name: /cancel manifest/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/scheduled send|automatic send|send schedule/i);
});

test("sent state proves approved and sent snapshots identical and retains append-only attempts", async ({ page }) => {
  await page.goto("/documents/demo?locale=en&demoState=sent");
  const snapshots = region(page, /approved and sent comparison/i);
  for (const label of ["Manifest hash", "Output hash", "Body hash", "Attachment hashes"]) {
    await expect(snapshots.getByRole("row", { name: new RegExp(label, "i") })).toContainText("Identical");
  }
  await expect(snapshots.getByRole("link", { name: /transport capture evidence/i })).toBeVisible();
  const attempts = region(page, /send attempts/i);
  await expect(attempts.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(attempts.getByText("SAFE_PROVIDER_UNAVAILABLE", { exact: true })).toBeVisible();
  await expect(attempts.getByText("provider-0007", { exact: true })).toBeVisible();
  await expect(attempts.getByRole("button", { name: /retry send/i })).toBeVisible();
});

test("controlled drift fails closed and requires a reasoned superseding revision", async ({ page }) => {
  await page.goto("/documents/demo?locale=en&demoState=drift");
  const driftAlert = page.getByRole("alert").filter({ hasText: /approved manifest no longer matches stored bytes/i });
  await expect(driftAlert).toContainText(/approved manifest no longer matches stored bytes/i);
  await expect(driftAlert).toContainText(/send blocked/i);
  const preview = region(page, /exact manifest preview/i);
  await expect(preview.getByRole("button", { name: /send now/i })).toBeDisabled();
  await expect(preview.getByLabel(/revision or cancellation reason/i)).toBeVisible();
  await expect(preview.getByText(/prior approval is inapplicable/i)).toBeVisible();
});
