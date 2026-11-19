import type { Page } from "@playwright/test";

/** Fixed test identities accepted by /api/sessions only under ORB_TEST_AUTH=1 on 127.0.0.1. */
const TEST_LOGINS = {
  owner: ["owner@example.test", "owner-secret-value"],
  operations: ["operations@example.test", "test-credential"],
  finance: ["finance@example.test", "test-credential"],
} as const;

/** Replaces the page's session with the given test role. Roles now come from the session, never from the URL. */
export async function signInAs(page: Page, role: keyof typeof TEST_LOGINS): Promise<void> {
  const [login, credential] = TEST_LOGINS[role];
  const response = await page.request.post("/api/sessions", { data: { login, credential } });
  if (response.status() !== 201) throw new Error(`test sign-in as ${role} failed with HTTP ${response.status()}`);
}

/** Drops all cookies so the next navigation is anonymous. */
export async function signOutLocally(page: Page): Promise<void> {
  await page.context().clearCookies();
}
