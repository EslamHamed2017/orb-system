import { NextRequest, NextResponse } from "next/server";

export interface CurrentSessionRouteDependencies {
  readonly signOut: (input: { request: NextRequest; expectedVersion: string; idempotencyKey: string; csrfToken: string }) => Promise<void>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase()}`, title: code, status, detail: "The session command could not be completed.", code }, { status, headers: { "content-type": "application/problem+json" } }); }
export function createCurrentSessionDeleteHandler(dependencies: CurrentSessionRouteDependencies) {
  return async function DELETE(request: NextRequest) {
    const expectedVersion = request.headers.get("if-match"), idempotencyKey = request.headers.get("idempotency-key"), csrfToken = request.headers.get("x-csrf-token");
    if (!expectedVersion) return problem(428, "PRECONDITION_REQUIRED");
    if (!idempotencyKey || !csrfToken) return problem(403, "PERMISSION_DENIED");
    await dependencies.signOut({ request, expectedVersion, idempotencyKey, csrfToken });
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set("__Host-orb_session", "", { secure: true, httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store"); return response;
  };
}
export async function DELETE() { return problem(503, "DEPENDENCY_UNAVAILABLE"); }
