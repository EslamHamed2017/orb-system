import { randomUUID, timingSafeEqual } from "node:crypto";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { runSerializable, type SerializableRetryOptions, type TransactionStarter } from "../database/transaction.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { executeIdempotently, type CommandResponse, type IdempotencyResult, type IdempotencyStore } from "../idempotency/store.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "./problem.ts";

export interface CsrfRequestInput {
  readonly expectedToken: string;
  readonly csrfToken?: string | null;
  readonly origin?: string | null;
  readonly referer?: string | null;
  readonly allowedOrigins: readonly string[];
  readonly correlationId?: string;
  readonly locale?: string | null;
}

function requestProblem(code: string, status: number, correlationId?: string, locale?: string | null) {
  return problemError({ code, status, correlationId: correlationId?.trim() || randomUUID(), locale });
}

export function parseQuotedIfMatch(value: string | null | undefined, context: Readonly<{ correlationId?: string; locale?: string | null }> = {}): number {
  if (value === undefined || value === null || value === "") {
    throw requestProblem("PRECONDITION_REQUIRED", 428, context.correlationId, context.locale);
  }
  if (!/^"[1-9][0-9]*"$/.test(value)) {
    throw requestProblem("VALIDATION_FAILED", 400, context.correlationId, context.locale);
  }
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version)) {
    throw requestProblem("VALIDATION_FAILED", 400, context.correlationId, context.locale);
  }
  return version;
}

function normalizedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function assertCsrfRequest(input: CsrfRequestInput): void {
  const deny = () => { throw requestProblem("PERMISSION_DENIED", 403, input.correlationId, input.locale); };
  if (typeof input.expectedToken !== "string" || typeof input.csrfToken !== "string") deny();
  const expected = Buffer.from(input.expectedToken, "utf8");
  const supplied = Buffer.from(input.csrfToken!, "utf8");
  if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) deny();

  const allowed = new Set(input.allowedOrigins.filter((value) => normalizedOrigin(value) === value));
  if (allowed.size === 0 || (!input.origin && !input.referer)) deny();
  if (input.origin) {
    const origin = normalizedOrigin(input.origin);
    if (origin === null || origin !== input.origin || !allowed.has(origin)) deny();
  }
  if (input.referer) {
    const refererOrigin = normalizedOrigin(input.referer);
    if (refererOrigin === null || !allowed.has(refererOrigin)) deny();
  }
}

export interface ExecuteCommandInput<TTransaction, TResult> {
  readonly operationId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly request: unknown;
  readonly expectedVersion?: number;
  readonly correlationId?: string;
  readonly locale?: string | null;
  readonly idempotencyStore: IdempotencyStore;
  readonly transact: TransactionStarter<TTransaction>;
  readonly transactionRetry?: SerializableRetryOptions;
  readonly loadCurrentVersion?: (transaction: TTransaction) => Promise<number>;
  readonly handle: (context: Readonly<{ transaction: TTransaction; correlationId: string }>) => Promise<CommandResponse<TResult>>;
}

export async function executeCommand<TTransaction, TResult>(input: ExecuteCommandInput<TTransaction, TResult>): Promise<IdempotencyResult<TResult>> {
  const correlationId = input.correlationId?.trim() || randomUUID();
  if (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) {
    throw problemError({ code: "VALIDATION_FAILED", status: 400, correlationId, locale: input.locale });
  }
  if (input.expectedVersion !== undefined && !input.loadCurrentVersion) {
    throw problemError({ code: "PRECONDITION_REQUIRED", status: 428, correlationId, locale: input.locale });
  }
  return executeIdempotently(input.idempotencyStore, {
    actorId: input.actorId,
    operationId: input.operationId,
    key: input.idempotencyKey,
    request: { body: input.request, expectedVersion: input.expectedVersion ?? null },
    correlationId,
    locale: input.locale,
  }, () => runSerializable(input.transact, async (transaction) => {
    if (input.expectedVersion !== undefined) {
      const currentVersion = await input.loadCurrentVersion!(transaction);
      if (currentVersion !== input.expectedVersion) {
        throw problemError({
          code: "STALE_VERSION",
          status: 412,
          correlationId,
          locale: input.locale,
          extensions: { expectedVersion: input.expectedVersion, currentVersion },
        });
      }
    }
    return input.handle({ transaction, correlationId });
  }, input.transactionRetry));
}
