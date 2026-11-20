import { expect, test, type Page } from "@playwright/test";

/** Claims and closure screens read live APIs; these checks stub those APIs and the signed-in user. */
const PROJECT = "33333333-3333-7333-8333-333333333333";
const OWNER = "55555555-5555-7555-8555-555555555555";
const OPS = "55555555-5555-7555-8555-555555555556";
const project = { id: PROJECT, reference: "ORB-PRJ-2026-000001", customerName: "Hamburg Roasters GmbH", currency: "USD", lifecycleState: "ACTIVE", finalState: "OPEN", closedAt: null, closedByName: null, reopenedAt: null, reopenReason: null, version: 3 };
const claim = (over: Record<string, unknown>) => ({
  id: "66666666-6666-7666-8666-666666666661", projectId: PROJECT, side: "CUSTOMER", type: "QUALITY", state: "UNDER_REVIEW", shipmentId: "77777777-7777-7777-8777-777777777771",
  shipmentReference: "OUT-0001", partyName: "Hamburg Roasters GmbH", description: "Moisture 13.4% against 12.5% max", quantity: null, amount: "2000.00", currency: "USD",
  settledAmount: null, openedByName: "Omar Ops", openedAt: "2026-11-20T09:00:00Z", closedAt: null, version: 2,
  document: { id: "88888888-8888-7888-8888-888888888881", filename: "survey.pdf", mediaType: "application/pdf", byteLength: 1200 }, proposal: null, ...over,
});
const CLAIMS = {
  project,
  shipments: [{ id: "77777777-7777-7777-8777-777777777771", side: "CUSTOMER", reference: "OUT-0001", partyName: "Hamburg Roasters GmbH" }, { id: "77777777-7777-7777-8777-777777777772", side: "SUPPLIER", reference: "IN-0001", partyName: "Aden Coffee Exporters" }],
  claims: [
    claim({ proposal: { id: "p1", outcome: "RESOLVED", amount: "1500.00", reason: "Agreed with buyer", state: "PENDING_APPROVAL", approvalId: "99999999-9999-7999-8999-999999999991", proposedById: OPS, proposedByName: "Omar Ops", proposedAt: null, decisionComment: null } }),
    claim({ id: "66666666-6666-7666-8666-666666666662", side: "SUPPLIER", type: "WEIGHT", state: "RESOLVED", shipmentReference: "IN-0001", partyName: "Aden Coffee Exporters", settledAmount: "800.00", amount: null,
      proposal: { id: "p2", outcome: "RESOLVED", amount: "800.00", reason: "Supplier credits short weight", state: "APPLIED", approvalId: null, proposedById: OPS, proposedByName: "Omar Ops", proposedAt: null, decisionComment: null } }),
  ],
};
const blocker = (id: string, code: string, reference: string, detail: string, exceptionReason: string | null = null) => ({ id, code, subjectType: "X", subjectId: id, reference, detail, href: `/projects/${PROJECT}/money`, exceptionReason, exceptionByName: exceptionReason ? "Omar Ops" : null, exceptionAt: null });
const CLOSURE = {
  project, pending: null, lastDecision: null,
  assessment: { id: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaa1", assessedAt: "2026-11-20T10:00:00Z", assessedByName: "Omar Ops", current: true, blockers: [
    blocker("bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb1", "SALES_INVOICE_UNPAID", "ORB-INV-2026-000001", "USD 61,720.00 not collected yet."),
    blocker("bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb2", "CLAIM_OPEN", "OUT-0001", "quality claim is under review.", "Settled after closing by credit note"),
  ] },
};

async function stub(page: Page, me: string, roles: string[], closure: unknown = CLOSURE) {
  const sent: { url: string; body: unknown }[] = [];
  await page.route("**/api/sessions/current", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessionId: "s", userId: me, login: "x", nameEn: "X", nameAr: "X", locale: "en", roles }) }));
  await page.route(`**/api/projects/${PROJECT}/claims`, (route) => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLAIMS) })
    : route.fulfill({ status: 201, contentType: "application/json", body: "{}" }));
  await page.route(`**/api/projects/${PROJECT}/closure-assessment`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(closure) }));
  await page.route("**/api/{approvals,claims,projects}/**/{decision,submit,submit-outcome,transition,closure-exceptions}", (route) => {
    sent.push({ url: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  return sent;
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} claims list shows sides, evidence, settled amounts and the pending outcome`, async ({ page }) => {
    const ar = locale === "ar";
    await stub(page, OWNER, ["OWNER_ADMIN"]);
    await page.goto(`/projects/${PROJECT}/claims?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: ar ? "المطالبات" : "Claims" })).toBeVisible();
    const cards = page.locator(".claims-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText(ar ? "بانتظار اعتماد المالك" : "Waiting for an owner to approve");
    await expect(cards.first().getByRole("link", { name: /survey\.pdf/ })).toHaveAttribute("href", "/api/evidence/88888888-8888-7888-8888-888888888881/content");
    await expect(cards.nth(1)).toContainText("USD 800.00");
    await expect(page.getByRole("navigation", { name: ar ? "مساحة عمل المشروع" : "Project workspace" }).getByRole("link", { name: ar ? "إغلاق المشروع" : "Project closure" })).toHaveAttribute("href", `/projects/${PROJECT}/closure?locale=${locale}`);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("an owner approves another person's claim outcome from the claim", async ({ page }) => {
  const sent = await stub(page, OWNER, ["OWNER_ADMIN"]);
  await page.goto(`/projects/${PROJECT}/claims`);
  await page.getByRole("button", { name: "Approve outcome" }).click();
  await expect.poll(() => sent.map((s) => [s.url, (s.body as { decision?: string }).decision])).toEqual([["/api/approvals/99999999-9999-7999-8999-999999999991/decision", "APPROVED"]]);
});

test("operations open a claim with evidence and cannot approve", async ({ page }) => {
  await stub(page, OPS, ["OPERATIONS"]);
  await page.goto(`/projects/${PROJECT}/claims`);
  await expect(page.getByRole("button", { name: "Approve outcome" })).toHaveCount(0);
  await page.locator(".claims-actions").getByRole("button", { name: "Open a claim" }).click();
  const form = page.locator("form.claims-form");
  await expect(form.locator("select[name=shipmentId] option")).toHaveCount(3);
  await expect(form.locator("input[name=file]")).toHaveAttribute("required", "");
});

test("closure lists open items, accepts the rest with a reason and asks to close only when all have one", async ({ page }) => {
  const sent = await stub(page, OPS, ["OPERATIONS"]);
  await page.goto(`/projects/${PROJECT}/closure`);
  await expect(page.locator(".closure-item")).toHaveCount(2);
  await expect(page.locator(".closure-item").nth(1)).toContainText("Settled after closing by credit note");
  await expect(page.getByRole("button", { name: "Close project" })).toHaveCount(0);
  await page.getByRole("button", { name: "Select all without a reason" }).click();
  await page.locator(".closure-form textarea[name=reason]").fill("Collected after closing; agreed with the owner");
  await page.getByRole("button", { name: "Accept with this reason" }).click();
  await expect.poll(() => sent.map((s) => s.body)).toEqual([{ assessmentId: CLOSURE.assessment.id, blockerIds: ["bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb1"], reason: "Collected after closing; agreed with the owner" }]);
});

test("a closed project is read-only and offers reopening with a reason; another owner decides", async ({ page }) => {
  const closed = { ...CLOSURE, project: { ...project, finalState: "FINAL_CLOSED", closedAt: "2026-11-20T11:00:00Z", closedByName: "Eslam Owner" },
    pending: { approvalId: "99999999-9999-7999-8999-999999999992", action: "REOPEN", requesterId: OPS, requesterName: "Omar Ops", requestedAt: null, reason: "Buyer disputes the certificate" } };
  const sent = await stub(page, OWNER, ["OWNER_ADMIN"], closed);
  await page.goto(`/projects/${PROJECT}/closure?locale=ar`);
  await expect(page.locator(".orb-chip").first()).toHaveText("مغلق");
  await expect(page.locator("body")).toContainText("للقراءة فقط");
  await page.getByRole("button", { name: "اعتماد إعادة الفتح" }).click();
  await expect.poll(() => sent.map((s) => s.url)).toEqual(["/api/approvals/99999999-9999-7999-8999-999999999992/decision"]);
});
