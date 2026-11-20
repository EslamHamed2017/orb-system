import { expect, test, type Page } from "@playwright/test";

/** Attachments read live APIs (projects + evidence); these checks stub them. */
const P1 = "11111111-1111-7111-8111-111111111111", P2 = "22222222-2222-7222-8222-222222222222";
const file = (id: string, projectId: string, projectReference: string, subjectType: string, subjectReference: string, originalFilename: string) =>
  ({ id, projectId, projectReference, subjectType, subjectId: id, subjectReference, purpose: "X", originalFilename, mediaType: "application/pdf", byteLength: 245760,
    uploadedAt: "2026-11-20T10:00:00.000Z", uploadedByName: "Fatma Finance", verificationState: "PENDING", contentHref: `/api/evidence/${id}/content` });
async function stub(page: Page) {
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: P1 }, { id: P2 }] }) }));
  await page.route(/\/api\/evidence\?projectId=.*/, (route) => {
    const projectId = new URL(route.request().url()).searchParams.get("projectId");
    const items = projectId === P1 ? [file("aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaa1", P1, "ORB-PRJ-2026-000001", "SUPPLIER_INVOICE", "AD-2026-0091", "supplier-bill.pdf")]
      : [file("bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbb1", P2, "ORB-PRJ-2026-000002", "CLAIM", "Water damage", "inspection-report.pdf")];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
  });
}

test("attachments list every project's files and link each to its source", async ({ page }) => {
  await stub(page);
  await page.goto("/attachments?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Attachments" })).toBeVisible();
  await expect(page.getByRole("row", { name: /supplier-bill\.pdf/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /inspection-report\.pdf/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "supplier-bill.pdf" })).toHaveAttribute("href", "/api/evidence/aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaa1/content");
  await expect(page.getByRole("link", { name: "AD-2026-0091" })).toHaveAttribute("href", `/projects/${P1}/transactions?locale=en`);
  await page.getByLabel("Attached to").selectOption("CLAIM");
  await expect(page.getByRole("row", { name: /supplier-bill\.pdf/ })).toHaveCount(0);
});

test("the project Attachments tab shows only that project's files, in Arabic RTL", async ({ page }) => {
  await stub(page);
  await page.goto(`/projects/${P2}/documents?locale=ar`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "المرفقات" })).toBeVisible();
  await expect(page.getByRole("row", { name: /inspection-report\.pdf/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /supplier-bill\.pdf/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "مساحة عمل المشروع" }).getByRole("link", { name: "المرفقات" })).toHaveAttribute("aria-current", "page");
});
