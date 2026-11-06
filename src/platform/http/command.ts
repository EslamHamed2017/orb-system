import { randomUUID } from "node:crypto";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { runSerializable, type SerializableRetryOptions, type TransactionStarter } from "../database/transaction.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { executeIdempotently, type CommandResponse, type IdempotencyResult, type IdempotencyStore } from "../idempotency/store.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "./problem.ts";

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
