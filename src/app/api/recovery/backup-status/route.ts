import { NextRequest, NextResponse } from "next/server";
export interface BackupStatusRouteDependencies { readonly getStatus: (request: NextRequest) => Promise<unknown>; }
export function createBackupStatusGetHandler(dependencies: BackupStatusRouteDependencies) { return async function GET(request: NextRequest) {
  return NextResponse.json(await dependencies.getStatus(request), { headers: { "Cache-Control": "no-store" } });
}; }
export async function GET() { return NextResponse.json({ code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
