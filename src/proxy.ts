import { NextRequest, NextResponse } from "next/server";

const PUBLIC_HEALTH = new Set(["/api/health/live", "/api/health/ready"]);
const PUBLIC_PAGES = new Set(["/sign-in"]);

/**
 * First line of defence only: requests without a session cookie never reach APIs or pages.
 * Every API still verifies the session, tenant and roles itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (PUBLIC_HEALTH.has(pathname) || (pathname === "/api/sessions" && request.method === "POST")) return NextResponse.next();
  if (!isApi && PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (request.cookies.has("__Host-orb_session")) return NextResponse.next();
  if (!isApi) {
    const target = request.nextUrl.clone();
    target.pathname = "/sign-in";
    target.search = "";
    const locale = request.nextUrl.searchParams.get("locale");
    if (locale === "ar" || locale === "en") target.searchParams.set("locale", locale);
    if (pathname !== "/") target.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(target);
  }
  return NextResponse.json({
    type: "https://orb.example/problems/authentication-required",
    title: "AUTHENTICATION_REQUIRED",
    status: 401,
    detail: "Authentication is required.",
    code: "AUTHENTICATION_REQUIRED",
    correlationId: crypto.randomUUID(),
  }, { status: 401, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js|woff2?)$).*)"] };
