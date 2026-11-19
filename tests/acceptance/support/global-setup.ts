import { request, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const ACCEPTANCE_STATE = "test-results/.auth/acceptance-owner.json";

/**
 * Pages now require a signed-in session. When the acceptance script provides a real
 * database account (ORB_ACCEPTANCE_LOGIN / ORB_ACCEPTANCE_PASSWORD), sign in once and
 * reuse the session cookies for every browser test.
 */
export default async function globalSetup(config: FullConfig) {
  const login = process.env.ORB_ACCEPTANCE_LOGIN, password = process.env.ORB_ACCEPTANCE_PASSWORD;
  if (!login || !password) return;
  const baseURL = config.projects[0]?.use.baseURL;
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/sessions", { data: { login, credential: password } });
  if (response.status() !== 201) throw new Error(`acceptance sign-in failed with HTTP ${response.status()}`);
  mkdirSync(dirname(ACCEPTANCE_STATE), { recursive: true });
  await context.storageState({ path: ACCEPTANCE_STATE });
  await context.dispose();
}
