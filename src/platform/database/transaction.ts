export interface SerializableRetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
}

export type TransactionStarter<TTransaction> = <T>(work: (transaction: TTransaction) => Promise<T>) => Promise<T>;

const RETRYABLE_CODES = new Set(["40001", "40P01", "P2034"]);

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  if (candidate.cause && candidate.cause !== error) return errorCode(candidate.cause);
  return undefined;
}

export function isRetryableSerializableError(error: unknown): boolean {
  return RETRYABLE_CODES.has(errorCode(error) ?? "");
}

const delay = (milliseconds: number) => milliseconds <= 0
  ? Promise.resolve()
  : new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function runSerializable<TTransaction, TResult>(
  start: TransactionStarter<TTransaction>,
  work: (transaction: TTransaction) => Promise<TResult>,
  options: SerializableRetryOptions = {},
): Promise<TResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 10;
  const maxDelayMs = options.maxDelayMs ?? 250;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new RangeError("maxAttempts must be a positive integer");
  for (let attempt = 1; ; attempt++) {
    try {
      return await start(work);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableSerializableError(error)) throw error;
      await options.onRetry?.(error, attempt);
      await delay(Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
}
