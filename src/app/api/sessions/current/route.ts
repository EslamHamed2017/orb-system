import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessProblemResponse, accessRuntime, assertSessionMutation, mapAccessErrors, sessionTokenHash, CSRF_COOKIE, SESSION_COOKIE } from "../../../../modules/access/access-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { findTestSession, forgetTestSession } from "../../../../modules/access/test-sessions.ts";
import type { AccessService } from "../../../../modules/access/access-service.ts";

export interface CurrentSessionDependencies {
  readonly service: () => Pick<AccessService, "currentSession" | "signOut">;
  readonly assertMutation: (request: Request) => void;
}

function clearCookies(response: NextResponse) {
  for (const name of [SESSION_COOKIE, CSRF_COOKIE]) {
    response.cookies.set(name, "", { secure: true, httpOnly: name === SESSION_COOKIE, sameSite: "strict", path: "/", maxAge: 0 });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function createCurrentSessionHandlers(deps: CurrentSessionDependencies) {
  return Object.freeze({
    /** Who is signed in: name, roles, locale. The browser uses this instead of URL role parameters. */
    async GET(request: Request) {
      const tokenHash = sessionTokenHash(request);
      if (!tokenHash) return accessProblemResponse(401, "AUTHENTICATION_REQUIRED");
      const test = findTestSession(tokenHash);
      if (test) {
        return NextResponse.json({
          sessionId: "00000000-0000-7000-8000-000000000000", userId: test.userId, login: null, nameEn: "Test user", nameAr: "مستخدم اختبار",
          locale: "en", roles: test.roles, mustChangePassword: false, version: 1, expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        }, { headers: { "Cache-Control": "no-store" } });
      }
      const session = await deps.service().currentSession(tokenHash);
      if (!session) return clearCookies(accessProblemResponse(401, "AUTHENTICATION_REQUIRED") as NextResponse);
      const { tenantId: _tenant, ...visible } = session;
      return NextResponse.json(visible, { headers: { "Cache-Control": "no-store" } });
    },

    /** Sign out: revokes this session server-side and clears the cookies. */
    async DELETE(request: Request) {
      const tokenHash = sessionTokenHash(request);
      if (tokenHash && findTestSession(tokenHash)) forgetTestSession(tokenHash);
      else if (tokenHash) {
        const session = await deps.service().currentSession(tokenHash);
        if (session) {
          deps.assertMutation(request);
          await deps.service().signOut({ tokenHash, tenantId: session.tenantId, userId: session.userId });
        }
      }
      return clearCookies(new NextResponse(null, { status: 204 }));
    },
  });
}

const handlers = createCurrentSessionHandlers({ service: () => accessRuntime().service, assertMutation: assertSessionMutation });
export const GET = mapAccessErrors(handlers.GET);
export const DELETE = mapAccessErrors(handlers.DELETE);
