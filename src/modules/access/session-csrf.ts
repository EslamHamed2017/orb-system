import { createHash } from "node:crypto";

/** Derives the one session-scoped CSRF token issued at sign-in for every mutation API. */
export function sessionCsrfToken(sessionToken: string): string {
  // Keep the established domain separator to avoid invalidating active sessions.
  return createHash("sha256").update(`orb-customer-csrf\0${sessionToken}`).digest("hex");
}
