import { NextRequest, NextResponse } from "next/server";
export interface RevokeSessionRouteDependencies { readonly revoke: (input: { request: NextRequest; userId: string; sessionId: string }) => Promise<unknown>; }
export function createRevokeSessionPostHandler(dependencies: RevokeSessionRouteDependencies) { return async function POST(request: NextRequest, context: { params: Promise<{ userId: string; sessionId: string }> }) { const { userId, sessionId } = await context.params; return NextResponse.json(await dependencies.revoke({ request, userId, sessionId })); }; }
export async function POST() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } }); }
