// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { localizeProblem } from "../i18n/problems.ts";

export interface ProblemFieldError {
  readonly pointer: string;
  readonly code: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: string;
  readonly correlationId: string;
  readonly errors?: readonly ProblemFieldError[];
  readonly [extension: string]: unknown;
}

export interface CreateProblemInput {
  readonly code: string;
  readonly status: number;
  readonly correlationId: string;
  readonly locale?: string | null;
  readonly type?: string;
  readonly title?: string;
  readonly detail?: string;
  readonly errors?: readonly ProblemFieldError[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}

const SAFE_EXTENSION = /^[a-z][A-Za-z0-9]*$/;

export function createProblem(input: CreateProblemInput): ProblemDetails {
  const copy = localizeProblem(input.code, input.locale);
  const extensions = Object.fromEntries(
    Object.entries(input.extensions ?? {}).filter(([key]) => SAFE_EXTENSION.test(key)
      && !["type", "title", "status", "detail", "code", "correlationId", "errors"].includes(key)),
  );
  return Object.freeze({
    type: input.type ?? `https://orb.example/problems/${input.code.toLowerCase().replaceAll("_", "-")}`,
    title: input.title ?? copy.title,
    status: input.status,
    detail: input.detail ?? copy.detail,
    code: input.code,
    correlationId: input.correlationId,
    ...(input.errors ? { errors: Object.freeze([...input.errors]) } : {}),
    ...extensions,
  });
}

export class ProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails, options?: ErrorOptions) {
    super(problem.detail, options);
    this.name = "ProblemError";
    this.problem = problem;
  }
}

export function problemError(input: CreateProblemInput, options?: ErrorOptions): ProblemError {
  return new ProblemError(createProblem(input), options);
}

export function isProblemError(value: unknown): value is ProblemError {
  return value instanceof ProblemError;
}
