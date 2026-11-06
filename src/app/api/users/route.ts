import { NextRequest, NextResponse } from "next/server";
export interface UsersRouteDependencies { readonly list: (request: NextRequest) => Promise<unknown>; }
export function createUsersGetHandler(dependencies: UsersRouteDependencies) { return async function GET(request: NextRequest) { return NextResponse.json(await dependencies.list(request), { headers: { "Cache-Control": "no-store" } }); }; }
export async function GET() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } }); }
