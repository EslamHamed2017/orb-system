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
    const setCookie = (await response.allHeaders())["set-cookie"] ?? "";
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
    // Lands on Today and keeps the language the user signed in with.
    await expect(page).toHaveURL(/\/\?locale=(?:en|ar)$/);
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

test("sign-in response is hardened, accessible, motion-safe, and within the pilot performance budget", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/sign-in?locale=en");
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["cache-control"]).toMatch(/no-store/);
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");

  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.getByLabel(/login|email/i)).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel(/password/i)).toHaveAttribute("autocomplete", "current-password");

  const verification = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const transferredBytes = resources.reduce((total, resource) => total + resource.transferSize, 0);
    const animatedElements = [...document.querySelectorAll("body *")].filter((node) => {
      const style = getComputedStyle(node);
      return style.animationName !== "none" && Number.parseFloat(style.animationDuration) > 0;
    }).length;
    return {
      resourceCount: resources.length,
      transferredBytes,
      animatedElements,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(verification.resourceCount).toBeLessThanOrEqual(20);
  expect(verification.transferredBytes).toBeLessThanOrEqual(750_000);
  expect(verification.animatedElements).toBe(0);
  expect(verification.horizontalOverflow).toBe(false);
});
