import { expect, test, type Page } from "@playwright/test";

const product = { reference: "PROD-004", nameEn: "Kenya AA", nameAr: "كينيا AA", origin: "KE", type: "Arabica", grade: "AA", cropYear: "2026", bagType: "Jute", weight: "60" };

type ProductRecord = {
  id: string; reference: string; nameEn: string; nameAr: string; origin: string; type: string; grade: string;
  cropYear: string; bagType: string; standardBagWeight: string; attributes: Record<string, unknown>;
  status: "ACTIVE" | "INACTIVE"; version: number;
};

async function mockProductsApi(page: Page) {
  let rows: ProductRecord[] = [];
  await page.route(/\/api\/products(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const id = new URL(request.url()).pathname.split("/").pop();
    if (method === "GET") {
      await route.fulfill({ status: 200, headers: { "x-orb-product-write-permitted": "true" }, contentType: "application/json", body: JSON.stringify({ items: rows, nextCursor: null }) });
      return;
    }
    const body = request.postDataJSON() as Partial<ProductRecord>;
    if (method === "POST") {
      const saved: ProductRecord = { ...body, id: "44444444-4444-4444-8444-444444444444", attributes: {}, status: "ACTIVE", version: 1 } as ProductRecord;
      rows = [saved];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(saved) });
      return;
    }
    expect(method).toBe("PATCH");
    const current = rows.find((row) => row.id === id);
    expect(current).toBeTruthy();
    expect(request.headers()["if-match"]).toBe(`"${current!.version}"`);
    const saved = { ...current!, ...body, version: current!.version + 1 };
    rows = rows.map((row) => row.id === saved.id ? saved : row);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(saved) });
  });
}

async function registerProduct(page: import("@playwright/test").Page, ar: boolean) {
  await page.getByText(ar ? "فتح نموذج تسجيل المنتج" : "Open product registration form").click();
  await page.getByLabel(ar ? "المرجع" : "Reference").fill(product.reference);
  await page.getByLabel(ar ? "الاسم بالإنجليزية" : "English name").fill(product.nameEn);
  await page.getByLabel(ar ? "الاسم بالعربية" : "Arabic name").fill(product.nameAr);
  await page.getByLabel(ar ? "المنشأ" : "Origin").fill(product.origin);
  await page.getByLabel(ar ? "النوع" : "Type", { exact: true }).fill(product.type);
  await page.getByLabel(ar ? "الدرجة" : "Grade").fill(product.grade);
  await page.getByLabel(ar ? "سنة المحصول" : "Crop year").fill(product.cropYear);
  await page.getByLabel(ar ? "نوع الكيس" : "Bag type").fill(product.bagType);
  await page.getByLabel(ar ? "وزن الكيس القياسي (كجم)" : "Standard bag weight (kg)").fill(product.weight);
  await page.getByRole("button", { name: ar ? "حفظ المنتج" : "Save product" }).click();
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} product registration persists and supports lifecycle`, async ({ page }, testInfo) => {
    const ar = locale === "ar";
    await mockProductsApi(page);
    await page.goto(`/masters/coffee?locale=${locale}`);
    await expect(page.locator("main > section")).toHaveAttribute("dir", ar ? "rtl" : "ltr");
    await expect(page.getByText(ar ? "لم تُسجل منتجات بعد" : "No products registered yet")).toBeVisible();
    await registerProduct(page, ar);
    await expect(page.getByText(ar ? "تم حفظ المنتج" : "Product saved")).toBeVisible();
    await expect(page.getByText(product.reference, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: ar ? "تعديل" : "Edit" }).click();
    await page.getByLabel(ar ? "الدرجة" : "Grade").fill("AB");
    await page.getByRole("button", { name: ar ? "حفظ التعديلات" : "Save changes" }).click();
    await expect(page.getByRole("table").getByText(/Arabica · AB/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(product.reference, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: ar ? "تعطيل" : "Deactivate" }).click();
    await expect(page.getByRole("table").getByText(ar ? "غير نشط" : "Inactive", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: ar ? "إعادة التفعيل" : "Reactivate" }).click();
    await expect(page.getByRole("table").getByText(ar ? "نشط" : "Active", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${locale}-desktop.png`), fullPage: true });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`mobile ${locale} product register has no horizontal page overflow`, async ({ page }, testInfo) => {
    const ar = locale === "ar";
    await mockProductsApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/masters/coffee?locale=${locale}`);
    await registerProduct(page, ar);
    const feedback = page.getByText(ar ? "تم حفظ المنتج" : "Product saved");
    await expect(feedback).toBeVisible();
    const feedbackBox = await feedback.boundingBox();
    expect(feedbackBox).not.toBeNull();
    expect(feedbackBox!.y).toBeGreaterThanOrEqual(0);
    expect(feedbackBox!.y + feedbackBox!.height).toBeLessThanOrEqual(844);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-mobile.png`), fullPage: true });
  });
}

test("invalid product API data shows an unavailable state instead of fixtures", async ({ page }) => {
  await page.route("**/api/products", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "invalid" }] }) }));
  await page.goto("/masters/coffee?locale=en");
  await expect(page.getByText("Product service is unavailable.")).toBeVisible();
  await expect(page.getByText("PROD-001", { exact: false })).toHaveCount(0);
});
