import { createHash } from "node:crypto";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "../http/problem.ts";

export interface CommandResponse<T = unknown> {
  readonly status: number;
  readonly value: T;
}

export interface IdempotencyInput {
  readonly actorId: string;
  readonly operationId: string;
  readonly key: string;
  readonly request: unknown;
  readonly correlationId?: string;
  readonly locale?: string | null;
}

export interface IdempotencyResult<T> extends CommandResponse<T> {
  readonly replayed: boolean;
}

interface StoredResult {
  readonly requestHash: string;
  readonly response: CommandResponse;
}

interface PendingResult {
  readonly requestHash: string;
  readonly promise: Promise<CommandResponse>;
  resolve(response: CommandResponse): void;
  reject(error: unknown): void;
}

export type IdempotencyAcquisition =
  | { readonly kind: "owner"; readonly pending: PendingResult }
  | { readonly kind: "pending"; readonly pending: PendingResult }
  | { readonly kind: "replay"; readonly stored: StoredResult }
  | { readonly kind: "conflict" };

export interface IdempotencyStore {
  acquire(scope: string, requestHash: string): Promise<IdempotencyAcquisition>;
  complete(scope: string, pending: PendingResult, response: CommandResponse): Promise<void>;
  abandon(scope: string, pending: PendingResult, error: unknown): Promise<void>;
}

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Idempotency request cannot contain non-finite numbers");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item, seen)).join(",")}]`;
  if (typeof value === "object") {
    if (seen.has(value)) throw new TypeError("Idempotency request cannot contain cycles");
    seen.add(value);
    const object = value as Record<string, unknown>;
    const result = `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key], seen)}`).join(",")}}`;
    seen.delete(value);
    return result;
  }
  throw new TypeError(`Unsupported idempotency request value: ${typeof value}`);
}

export function hashIdempotencyRequest(request: unknown): string {
  return createHash("sha256").update(canonicalJson(request), "utf8").digest("hex");
}

function scopeOf(input: IdempotencyInput): string {
  if (!input.actorId || !input.operationId) throw new TypeError("actorId and operationId are required");
  if (input.key.length < 16 || input.key.length > 128) throw new TypeError("Idempotency key must contain 16 to 128 characters");
  return `${input.actorId.length}:${input.actorId}${input.operationId.length}:${input.operationId}${input.key.length}:${input.key}`;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, StoredResult | PendingResult>();

  async acquire(scope: string, requestHash: string): Promise<IdempotencyAcquisition> {
    const existing = this.records.get(scope);
    if (existing) {
      if (existing.requestHash !== requestHash) return { kind: "conflict" };
      return "response" in existing ? { kind: "replay", stored: existing } : { kind: "pending", pending: existing };
    }
    let resolve!: (response: CommandResponse) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<CommandResponse>((accepted, rejected) => { resolve = accepted; reject = rejected; });
    void promise.catch(() => undefined);
    const pending: PendingResult = { requestHash, promise, resolve, reject };
    this.records.set(scope, pending);
    return { kind: "owner", pending };
  }

  async complete(scope: string, pending: PendingResult, response: CommandResponse): Promise<void> {
    if (this.records.get(scope) !== pending) throw new Error("Idempotency ownership lost");
    this.records.set(scope, { requestHash: pending.requestHash, response });
    pending.resolve(response);
  }

  async abandon(scope: string, pending: PendingResult, error: unknown): Promise<void> {
    if (this.records.get(scope) === pending) this.records.delete(scope);
    pending.reject(error);
  }
}

export async function executeIdempotently<T>(
  store: IdempotencyStore,
  input: IdempotencyInput,
  execute: () => Promise<CommandResponse<T>>,
): Promise<IdempotencyResult<T>> {
  const scope = scopeOf(input);
  const requestHash = hashIdempotencyRequest(input.request);
  const acquired = await store.acquire(scope, requestHash);
  if (acquired.kind === "conflict") throw problemError({ code: "IDEMPOTENCY_KEY_REUSED", status: 409, correlationId: input.correlationId ?? "unknown", locale: input.locale });
  if (acquired.kind === "replay") return { ...(acquired.stored.response as CommandResponse<T>), replayed: true };
  if (acquired.kind === "pending") return { ...(await acquired.pending.promise as CommandResponse<T>), replayed: true };
  try {
    const response = await execute();
    await store.complete(scope, acquired.pending, response);
    return { ...response, replayed: false };
  } catch (error) {
    await store.abandon(scope, acquired.pending, error);
    throw error;
  }
}
