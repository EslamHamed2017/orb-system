import { NextRequest, NextResponse } from "next/server";
export interface UserSessionsRouteDependencies { readonly list: (input: { request: NextRequest; userId: string }) => Promise<unknown>; }
export function createUserSessionsGetHandler(dependencies: UserSessionsRouteDependencies) { return async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) { const { userId } = await context.params; return NextResponse.json(await dependencies.list({ request, userId }), { headers: { "Cache-Control": "no-store" } }); }; }
export async function GET() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } }); }
