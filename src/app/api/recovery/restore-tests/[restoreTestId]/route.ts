import { NextRequest, NextResponse } from "next/server";
export interface RestoreTestRouteDependencies { readonly get: (restoreTestId: string, request: NextRequest) => Promise<unknown>; }
export function createRestoreTestGetHandler(dependencies: RestoreTestRouteDependencies) { return async function GET(request: NextRequest, context: { params: Promise<{ restoreTestId: string }> }) {
  const { restoreTestId } = await context.params; return NextResponse.json(await dependencies.get(restoreTestId, request), { headers: { "Cache-Control": "no-store" } });
}; }
export async function GET() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
