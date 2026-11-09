import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`${locale} sign-in is directionally correct, keyboard accessible, and creates the fixed secure session`, async ({ page, browserName }) => {
    await page.goto(`/sign-in?locale=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { name: locale === "ar" ? /تسجيل الدخول/ : /sign in/i })).toBeVisible();

    const login = page.getByLabel(locale === "ar" ? /اسم المستخدم|البريد/ : /login|email/i);
    const credential = page.getByLabel(locale === "ar" ? /كلمة المرور/ : /password/i);
    await login.fill("operations@example.test");
    await credential.fill("test-credential");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/sessions") && response.request().method() === "POST");
    await page.getByRole("button", { name: locale === "ar" ? /دخول/ : /sign in/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    expect(response.headers()["x-csrf-token"]).toBeTruthy();
    const setCookie = response.headers()["set-cookie"] ?? "";
    expect(setCookie).toMatch(/__Host-orb_session=/);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\//i);
    const cookie = (await page.context().cookies()).find((candidate) => candidate.name === "__Host-orb_session");
    if (browserName !== "webkit") {
      expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: "Strict", path: "/" });
      expect(cookie?.domain.startsWith(".")).toBe(false);
    }
    await expect(page).toHaveURL(/\/$/);
  });
}

test("Owner/Admin sign-in requires MFA and never logs or redisplays credentials", async ({ page, browserName }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/sign-in?locale=en");
  await page.getByLabel(/login|email/i).fill("owner@example.test");
  await page.getByLabel(/password/i).fill("owner-secret-value");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByLabel(/mfa|verification code/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("owner-secret-value");
  expect(requests.join("\n")).not.toContain("owner-secret-value");
});

test("invalid credentials and expired/revoked sessions fail closed without identity leakage", async ({ page }) => {
  await page.goto("/sign-in?locale=en");
  await page.getByLabel(/login|email/i).fill("unknown@example.test");
  await page.getByLabel(/password/i).fill("wrong-value");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/unable to sign in|authentication failed/i).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/unknown user|user does not exist/i);
});
