import { NextRequest, NextResponse } from "next/server";
export interface RestoreTestsRouteDependencies { readonly start: (request: NextRequest) => Promise<unknown>; }
export function createRestoreTestsPostHandler(dependencies: RestoreTestsRouteDependencies) { return async function POST(request: NextRequest) {
  return NextResponse.json(await dependencies.start(request), { status: 202, headers: { "Cache-Control": "no-store" } });
}; }
export async function POST() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
