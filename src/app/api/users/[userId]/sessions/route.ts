import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessRuntime, asActor, assertSessionMutation, authenticateRequest, mapAccessErrors, requireActor } from "../../../../../modules/access/access-runtime.ts";
export interface UserSessionsRouteDependencies { readonly list: (input: { request: NextRequest; userId: string }) => Promise<unknown>; }
export function createUserSessionsGetHandler(dependencies: UserSessionsRouteDependencies) { return async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) { const { userId } = await context.params; return NextResponse.json(await dependencies.list({ request, userId }), { headers: { "Cache-Control": "no-store" } }); }; }
export const GET = mapAccessErrors(createUserSessionsGetHandler({
  list: async ({ request, userId }) => accessRuntime().service.listSessions(await requireActor(request), userId),
}));
