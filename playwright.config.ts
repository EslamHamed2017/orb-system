import { defineConfig, devices } from "@playwright/test";

const managedServer = process.env.ORB_TEST_MANAGED_SERVER === "1";
const managedPort = process.env.ORB_TEST_PORT ?? "3000";
const baseURL = process.env.ORB_TEST_BASE_URL ?? `http://127.0.0.1:${managedPort}`;
// Signed-in browser state, created by the global setup when a real acceptance account is provided.
const signedIn = Boolean(process.env.ORB_ACCEPTANCE_LOGIN && process.env.ORB_ACCEPTANCE_PASSWORD) || (process.env.ORB_TEST_AUTH === "1" && managedServer);

export default defineConfig({
  testDir: "tests/acceptance",
  globalSetup: "./tests/acceptance/support/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    ...(signedIn ? { storageState: "test-results/.auth/acceptance-owner.json" } : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: managedServer ? {
    command: `corepack pnpm exec next start --hostname 127.0.0.1 --port ${managedPort}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
  } : undefined,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
