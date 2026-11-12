export type ReadinessChecks = Readonly<Record<string, () => Promise<boolean>>>;
const SAFE_NAME = /^[a-z][A-Za-z0-9]{0,63}$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;

export function createReadinessHandler(
  checks: ReadinessChecks,
  now: () => string = () => new Date().toISOString(),
  releaseCommit: string | undefined = process.env.ORB_RELEASE_COMMIT,
) {
  return async function GET(): Promise<Response> {
    const entries = await Promise.all(Object.entries(checks).map(async ([name, check]) => {
      if (!SAFE_NAME.test(name)) throw new TypeError("unsafe readiness check name");
      try { return [name, (await check()) ? "up" : "down"] as const; }
      catch { return [name, "down"] as const; }
    }));
    entries.sort(([a], [b]) => a.localeCompare(b));
    const result = Object.fromEntries(entries);
    const ready = entries.length > 0 && entries.every(([, state]) => state === "up");
    return Response.json({
      status: ready ? "ready" : "not-ready",
      checkedAt: now(),
      checks: result,
      release: { gitCommit: GIT_COMMIT.test(releaseCommit ?? "") ? releaseCommit : null },
    }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
  };
}

export const GET = createReadinessHandler({
  auditChain: async () => process.env.ORB_AUDIT_CHAIN_HEALTHY === "1",
  database: async () => Boolean(process.env.DATABASE_URL),
  objectStorage: async () => Boolean(process.env.OBJECT_STORAGE_ENDPOINT),
});
