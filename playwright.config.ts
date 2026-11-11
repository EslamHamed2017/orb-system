import { defineConfig, devices } from "@playwright/test";

const managedServer = process.env.ORB_TEST_MANAGED_SERVER === "1";
const managedPort = process.env.ORB_TEST_PORT ?? "3000";
const baseURL = process.env.ORB_TEST_BASE_URL ?? `http://127.0.0.1:${managedPort}`;

export default defineConfig({
  testDir: "tests/acceptance",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL,
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
