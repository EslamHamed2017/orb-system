// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { assertAuthenticatedMutation } from "./csrf.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { problemError } from "./problem.ts";

export function authorizeOperation(input: {
  actor: { userId: string; roles: readonly string[] };
  requiredRoles: readonly string[];
  correlationId?: string;
  mutation?: { expectedToken: string; suppliedToken?: string | null; origin?: string | null; referer?: string | null; allowedOrigins: readonly string[] };
}): void {
  if (input.requiredRoles.length > 0 && !input.actor.roles.some((role) => input.requiredRoles.includes(role))) {
    throw problemError({
      code: "PERMISSION_DENIED",
      status: 403,
      detail: "Permission is denied for this operation.",
      correlationId: input.correlationId?.trim() || crypto.randomUUID(),
    });
  }
  if (input.mutation) assertAuthenticatedMutation({ ...input.mutation, correlationId: input.correlationId });
}
