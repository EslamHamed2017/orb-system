import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessRuntime, asActor, assertSessionMutation, authenticateRequest, mapAccessErrors, requireActor } from "../../../../../../../modules/access/access-runtime.ts";
export interface RevokeSessionRouteDependencies { readonly revoke: (input: { request: NextRequest; userId: string; sessionId: string }) => Promise<unknown>; }
export function createRevokeSessionPostHandler(dependencies: RevokeSessionRouteDependencies) { return async function POST(request: NextRequest, context: { params: Promise<{ userId: string; sessionId: string }> }) { const { userId, sessionId } = await context.params; return NextResponse.json(await dependencies.revoke({ request, userId, sessionId })); }; }
export const POST = mapAccessErrors(createRevokeSessionPostHandler({
  revoke: async ({ request, userId, sessionId }) => {
    const actor = await requireActor(request);
    assertSessionMutation(request);
    return accessRuntime().service.revokeSession(actor, userId, sessionId);
  },
}));
