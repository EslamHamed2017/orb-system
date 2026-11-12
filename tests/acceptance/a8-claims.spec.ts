import { expect, test, type Locator, type Page } from "@playwright/test";

const copy = {
  en: {
    heading: "Simple claims", open: "Open claim", history: "Claim lifecycle", panel: "Sales shipment claims",
    review: "Move to review", propose: "Propose outcome", reason: "Outcome reason", evidence: "Outcome evidence",
    apply: "Apply approved outcome", blocker: "Final close blocker",
  },
  ar: {
    heading: "المطالبات البسيطة", open: "فتح مطالبة", history: "دورة حياة المطالبة", panel: "مطالبات شحنة البيع",
    review: "نقل إلى المراجعة", propose: "اقتراح النتيجة", reason: "سبب النتيجة", evidence: "دليل النتيجة",
    apply: "تطبيق النتيجة المعتمدة", blocker: "مانع الإغلاق النهائي",
  },
} as const;

function region(page: Page, name: string | RegExp): Locator {
  return page.getByRole("region", { name });
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} workspace exposes the simple open-to-review lifecycle without terminal shortcuts`, async ({ page }) => {
    const text = copy[locale];
    await page.goto(`/projects/demo/claims?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: text.heading })).toBeVisible();
    const form = region(page, text.open);
    await expect(form.getByLabel(locale === "ar" ? "نوع المطالبة" : "Claim type")).toContainText(locale === "ar" ? "الجودة" : "Quality");
    await expect(form.getByLabel(locale === "ar" ? "الطرف المطالب" : "Claimant")).toBeVisible();
    await expect(form.getByLabel(locale === "ar" ? "الطرف المدعى عليه" : "Respondent")).toBeVisible();
    await expect(form.getByLabel(locale === "ar" ? "الوصف" : "Description")).toBeVisible();
    await expect(form.getByLabel(locale === "ar" ? "الدليل" : "Evidence")).toBeVisible();
    const lifecycle = region(page, text.history);
    await expect(lifecycle.getByText("CLAIM-0007", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText(locale === "ar" ? "مفتوحة" : "OPEN", { exact: true })).toBeVisible();
    await expect(lifecycle.getByRole("button", { name: text.review })).toBeVisible();
    await expect(lifecycle).not.toContainText(/resolve claim|reject claim|تسوية المطالبة|رفض المطالبة/i);
  });
}

test("under-review proposal preserves exact outcome reason and evidence while pending approval", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en&demoState=pending");
  const lifecycle = region(page, /claim lifecycle/i);
  await expect(lifecycle.getByText("UNDER REVIEW", { exact: true })).toBeVisible();
  await expect(lifecycle.getByRole("button", { name: /propose outcome/i })).toBeVisible();
  const proposal = region(page, /outcome proposal/i);
  await expect(proposal.getByLabel(/proposed outcome/i)).toHaveValue("RESOLVED");
  await expect(proposal.getByLabel(/outcome reason/i)).toHaveValue("Claim accepted after quality review");
  await expect(proposal.getByLabel(/outcome evidence/i)).toHaveValue("EVIDENCE-OUTCOME-0008");
  await expect(proposal.getByText(/approval.*pending/i)).toBeVisible();
  await expect(proposal).not.toContainText(/apply approved outcome/i);
});

test("rejected approval leaves the claim under review and exposes no Apply action", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en&demoState=rejected");
  const lifecycle = region(page, /claim lifecycle/i);
  await expect(lifecycle.getByText("UNDER REVIEW", { exact: true })).toBeVisible();
  const proposal = region(page, /outcome proposal/i);
  await expect(proposal.getByText(/approval.*rejected/i)).toBeVisible();
  await expect(proposal.getByText(/proposal rejected.*claim remains under review/i)).toBeVisible();
  await expect(proposal).not.toContainText(/apply approved outcome/i);
});

test("only a current approved exact proposal reveals Apply and terminal result", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en&demoState=approved");
  const proposal = region(page, /outcome proposal/i);
  await expect(proposal.getByText(/approval.*approved/i)).toBeVisible();
  await expect(proposal.getByText(/claim version 2/i)).toBeVisible();
  await expect(proposal.getByText(/[a-f0-9]{64}/)).toBeVisible();
  await expect(proposal.getByRole("button", { name: /apply approved outcome/i })).toBeVisible();

  await page.goto("/projects/demo/claims?locale=en&demoState=resolved");
  const lifecycle = region(page, /claim lifecycle/i);
  await expect(lifecycle.getByText("RESOLVED", { exact: true })).toBeVisible();
  await expect(lifecycle).not.toContainText(/move to review|propose outcome|apply approved outcome/i);
});

test("open and under-review claims are explicit final-close blockers", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en&demoState=pending");
  const blocker = region(page, /final close blocker/i);
  await expect(blocker.getByText("CLAIM-0007", { exact: true })).toBeVisible();
  await expect(blocker.getByText(/under review.*must reach an approved terminal outcome/i)).toBeVisible();
});

test("stable sales-shipment Claims panel is composable and omits advanced settlement controls", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en");
  const panel = region(page, /sales shipment claims/i);
  await expect(panel.getByText("ORB-SAL-0007", { exact: true })).toBeVisible();
  await expect(panel.getByText("CLAIM-0007", { exact: true })).toBeVisible();
  await expect(panel.getByText(/quality.*open/i)).toBeVisible();
  await expect(panel).not.toContainText(/resolve claim|reject claim|discount|replacement logistics|compensation|netting|settlement/i);
});


test("claim workspace binds immutable attachments and honors read-only access", async ({ page }) => {
  await page.goto("/projects/demo/claims?locale=en");
  const attachments = page.getByRole("region", { name: "Attachments" });
  await expect(attachments).toHaveAttribute("data-backend-endpoint", "/api/evidence?projectId=demo&subjectType=CLAIM&subjectId=claim-0007");
  await expect(attachments.locator('input[name="subjectType"]')).toHaveValue("CLAIM");
  await expect(attachments.getByRole("button", { name: "Upload and verify" })).toBeVisible();

  await page.goto("/projects/demo/claims?locale=ar&role=finance-viewer");
  const readOnly = page.getByRole("region", { name: "مرفقات" });
  await expect(readOnly.getByRole("button", { name: "رفع والتحقق" })).toHaveCount(0);
  await expect(readOnly.getByText(/عرض فقط للمرفقات/)).toBeVisible();
});
