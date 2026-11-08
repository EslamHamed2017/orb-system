import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const R1_TIMING_LIMITS_MS = Object.freeze({ read: 500, mutation: 800, documentAccept: 2_000, documentRender: 30_000 });
export type TimingKind = keyof typeof R1_TIMING_LIMITS_MS;
type Invocation = Readonly<{ kind: TimingKind; sessionId: number; iteration: number }>;
type InvocationResult = Readonly<{ durationMs: number; ok: boolean; failureCode?: string }>;
type Metric = Readonly<{ count: number; p95Ms: number; maxMs: number; limitMs: number; passed: boolean }>;
export interface R1LoadReport {
  readonly mode: "construction" | "deployed";
  readonly sessionCount: number;
  readonly iterationsPerSession: number;
  readonly metrics: Readonly<Record<TimingKind, Metric>>;
  readonly failures: readonly Readonly<{ kind: TimingKind; sessionId: number; iteration: number; code: string }>[];
  readonly thresholdsPassed: boolean;
}
const KINDS = Object.freeze(Object.keys(R1_TIMING_LIMITS_MS) as TimingKind[]);

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) throw new RangeError("percentile requires samples");
  if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) throw new RangeError("quantile must be in (0, 1]");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)]!;
}

export async function runR1Load(options: {
  sessionCount: number;
  iterationsPerSession: number;
  mode?: "construction" | "deployed";
  invoke: (input: Invocation) => Promise<InvocationResult>;
}): Promise<R1LoadReport> {
  if (options.sessionCount !== 50) throw new RangeError("R1 load requires exactly 50 sessions");
  if (!Number.isSafeInteger(options.iterationsPerSession) || options.iterationsPerSession < 1) throw new RangeError("iterationsPerSession must be a positive integer");
  const samples: Record<TimingKind, number[]> = { read: [], mutation: [], documentAccept: [], documentRender: [] };
  const failures: Array<{ kind: TimingKind; sessionId: number; iteration: number; code: string }> = [];
  const invocations: Invocation[] = [];
  for (let sessionId = 0; sessionId < options.sessionCount; sessionId++) for (let iteration = 0; iteration < options.iterationsPerSession; iteration++) for (const kind of KINDS) invocations.push({ kind, sessionId, iteration });
  await Promise.all(invocations.map(async (input) => {
    try {
      const result = await options.invoke(input);
      if (!Number.isFinite(result.durationMs) || result.durationMs < 0) throw new RangeError("invalid duration");
      samples[input.kind].push(result.durationMs);
      if (!result.ok) failures.push({ ...input, code: safeCode(result.failureCode) });
    } catch (error) {
      failures.push({ ...input, code: safeCode(error instanceof Error ? error.name : "INVOCATION_FAILED") });
    }
  }));
  const metrics = Object.fromEntries(KINDS.map((kind) => {
    const values = samples[kind], limitMs = R1_TIMING_LIMITS_MS[kind];
    const metric: Metric = Object.freeze({ count: values.length, p95Ms: values.length ? percentile(values, 0.95) : Number.POSITIVE_INFINITY, maxMs: values.length ? Math.max(...values) : Number.POSITIVE_INFINITY, limitMs, passed: values.length === options.sessionCount * options.iterationsPerSession && percentile(values, 0.95) <= limitMs });
    return [kind, metric];
  })) as unknown as Record<TimingKind, Metric>;
  return Object.freeze({ mode: options.mode ?? "construction", sessionCount: options.sessionCount, iterationsPerSession: options.iterationsPerSession, metrics: Object.freeze(metrics), failures: Object.freeze(failures.sort((a, b) => a.sessionId - b.sessionId || a.iteration - b.iteration || a.kind.localeCompare(b.kind))), thresholdsPassed: failures.length === 0 && KINDS.every((kind) => metrics[kind].passed) });
}

function safeCode(value: unknown): string {
  const code = typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : "INVOCATION_FAILED";
  return /COOKIE|CSRF|TOKEN|PASSWORD|SECRET|AUTHORIZATION/.test(code) ? "REDACTED_FAILURE" : code;
}
export function assertR1Thresholds(report: R1LoadReport): void {
  if (report.sessionCount !== 50 || report.failures.length || !report.thresholdsPassed || KINDS.some((kind) => report.metrics[kind].count !== 50 * report.iterationsPerSession)) throw new Error("R1 performance or invariant threshold failed");
}

type RequestTemplate = Readonly<{ method: string; path: string; body?: unknown; acceptedStatuses: readonly number[] }>;
type DeployedConfig = Readonly<{ origin: string; iterationsPerSession: number; sessions: readonly Readonly<{ cookie: string; csrfToken: string }>[]; requests: Readonly<Record<TimingKind, RequestTemplate>> }>;
function replace(value: unknown, sessionId: number, iteration: number): unknown {
  if (typeof value === "string") return value.replaceAll("{session}", String(sessionId)).replaceAll("{iteration}", String(iteration));
  if (Array.isArray(value)) return value.map((item) => replace(item, sessionId, iteration));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item, sessionId, iteration)]));
  return value;
}
function validateDeployedConfig(value: unknown): DeployedConfig {
  if (!value || typeof value !== "object") throw new TypeError("deployed config must be an object");
  const config = value as DeployedConfig, origin = new URL(config.origin);
  if (origin.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) throw new Error("deployed origin must be non-local HTTPS");
  if (!Array.isArray(config.sessions) || config.sessions.length !== 50 || config.sessions.some((row) => !row || typeof row.cookie !== "string" || !row.cookie.startsWith("__Host-orb_session=") || typeof row.csrfToken !== "string" || !row.csrfToken)) throw new Error("deployed config requires exactly 50 valid sessions");
  if (!Number.isSafeInteger(config.iterationsPerSession) || config.iterationsPerSession < 1) throw new Error("invalid deployed iteration count");
  for (const kind of KINDS) { const row = config.requests?.[kind]; if (!row || typeof row.path !== "string" || !row.path.startsWith("/") || typeof row.method !== "string" || !Array.isArray(row.acceptedStatuses) || !row.acceptedStatuses.length) throw new Error(`missing deployed request template: ${kind}`); }
  return config;
}
async function deployedRun(path: string): Promise<R1LoadReport> {
  const config = validateDeployedConfig(JSON.parse(await readFile(path, "utf8")));
  return runR1Load({ mode: "deployed", sessionCount: 50, iterationsPerSession: config.iterationsPerSession, invoke: async ({ kind, sessionId, iteration }) => {
    const template = config.requests[kind], session = config.sessions[sessionId]!;
    const start = performance.now();
    const response = await fetch(new URL(String(replace(template.path, sessionId, iteration)), config.origin), { method: template.method, redirect: "error", headers: { cookie: session.cookie, "x-csrf-token": session.csrfToken, origin: config.origin, referer: `${config.origin}/` , "content-type": "application/json" }, body: template.body === undefined ? undefined : JSON.stringify(replace(template.body, sessionId, iteration)) });
    return { durationMs: performance.now() - start, ok: template.acceptedStatuses.includes(response.status), failureCode: response.ok ? "UNEXPECTED_STATUS" : `HTTP_${response.status}` };
  }});
}
async function main(): Promise<void> {
  const mode = process.env.ORB_R1_LOAD_MODE;
  let report: R1LoadReport;
  if (mode === "dry-run") report = await runR1Load({ sessionCount: 50, iterationsPerSession: 2, invoke: async ({ kind, sessionId, iteration }) => ({ durationMs: ({ read: 100, mutation: 200, documentAccept: 500, documentRender: 2_000 }[kind]) + sessionId + iteration, ok: true }) });
  else if (mode === "deployed" && process.env.ORB_R1_LOAD_CONFIG) report = await deployedRun(process.env.ORB_R1_LOAD_CONFIG);
  else throw new Error("set ORB_R1_LOAD_MODE=dry-run or deployed with ORB_R1_LOAD_CONFIG");
  assertR1Thresholds(report); process.stdout.write(`${JSON.stringify(report)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
