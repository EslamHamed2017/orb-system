import { NextRequest, NextResponse } from "next/server";
export interface UserRolesRouteDependencies { readonly assign: (input: { request: NextRequest; userId: string }) => Promise<unknown>; }
export function createUserRolesPutHandler(dependencies: UserRolesRouteDependencies) { return async function PUT(request: NextRequest, context: { params: Promise<{ userId: string }> }) { const { userId } = await context.params; return NextResponse.json(await dependencies.assign({ request, userId })); }; }
export async function PUT() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } }); }
