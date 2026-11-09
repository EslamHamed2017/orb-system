import { NextRequest, NextResponse } from "next/server";

const PUBLIC_HEALTH = new Set(["/api/health/live", "/api/health/ready"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_HEALTH.has(pathname) || (pathname === "/api/sessions" && request.method === "POST")) return NextResponse.next();
  if (request.cookies.has("__Host-orb_session")) return NextResponse.next();
  return NextResponse.json({
    type: "https://orb.example/problems/authentication-required",
    title: "AUTHENTICATION_REQUIRED",
    status: 401,
    detail: "Authentication is required.",
    code: "AUTHENTICATION_REQUIRED",
    correlationId: crypto.randomUUID(),
  }, { status: 401, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } });
}

export const config = { matcher: ["/api/:path*"] };
