/**
 * Test-only in-memory sessions for the database-less local acceptance run.
 * Active only when ORB_TEST_AUTH=1, the app origin is a 127.0.0.1 address, and no DATABASE_URL is set,
 * which is the same gate that enables the fixed test identities in /api/sessions.
 */
export interface TestSessionIdentity {
  readonly userId: string;
  readonly roles: readonly string[];
}

const sessions = new Map<string, TestSessionIdentity>();

export function testSessionsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ORB_TEST_AUTH === "1" && Boolean(env.ORB_APP_ORIGIN?.startsWith("http://127.0.0.1:")) && !env.DATABASE_URL;
}

export function rememberTestSession(tokenHash: string, identity: TestSessionIdentity): void {
  if (testSessionsEnabled()) sessions.set(tokenHash, identity);
}

export function findTestSession(tokenHash: string): TestSessionIdentity | null {
  return testSessionsEnabled() ? sessions.get(tokenHash) ?? null : null;
}

export function forgetTestSession(tokenHash: string): void {
  sessions.delete(tokenHash);
}
