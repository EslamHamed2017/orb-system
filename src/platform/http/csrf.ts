// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { assertCsrfRequest } from "./command.ts";

export function assertAuthenticatedMutation(input: {
  expectedToken: string;
  suppliedToken?: string | null;
  origin?: string | null;
  referer?: string | null;
  allowedOrigins: readonly string[];
  correlationId?: string;
}): void {
  assertCsrfRequest({
    expectedToken: input.expectedToken,
    csrfToken: input.suppliedToken,
    origin: input.origin,
    referer: input.referer,
    allowedOrigins: input.allowedOrigins,
    correlationId: input.correlationId,
  });
}
