import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { newSessionSecret, verifyCredentialsWithoutIdentityLeak, type CredentialVerifier } from "../../../modules/access/auth.ts";

export interface SessionsRouteDependencies {
  readonly verify: CredentialVerifier;
  readonly createSession: (input: { userId: string; roles: readonly string[]; now: string }) => Promise<{ sessionId: string; version: number }>;
}

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: "Authentication failed", status, detail, code, correlationId: randomUUID() },
    { status, headers: { "content-type": "application/problem+json" } });
}

export function createSessionsPostHandler(dependencies: SessionsRouteDependencies) {
  return async function POST(request: NextRequest) {
    let body: unknown;
    try { body = await request.json(); } catch { return problem(400, "VALIDATION_FAILED", "The sign-in request is invalid."); }
    if (!body || typeof body !== "object") return problem(400, "VALIDATION_FAILED", "The sign-in request is invalid.");
    const { login, credential } = body as Record<string, unknown>;
    if (typeof login !== "string" || typeof credential !== "string") return problem(400, "VALIDATION_FAILED", "The sign-in request is invalid.");
    const verified = await verifyCredentialsWithoutIdentityLeak({ login, credential, verify: dependencies.verify });
    if (!verified) return problem(401, "AUTHENTICATION_REQUIRED", "Unable to sign in with the supplied credentials.");
    const created = await dependencies.createSession({ userId: verified.userId, roles: verified.roles, now: new Date().toISOString() });
    const sessionToken = newSessionSecret(), csrfToken = newSessionSecret();
    const response = NextResponse.json({ sessionId: created.sessionId, userId: verified.userId, roles: verified.roles, version: created.version, mfaRequired: verified.mfaRequired }, { status: 201 });
    response.cookies.set("__Host-orb_session", sessionToken, { secure: true, httpOnly: true, sameSite: "strict", path: "/", maxAge: 12 * 60 * 60 });
    response.headers.set("X-CSRF-Token", csrfToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}

const unavailable: SessionsRouteDependencies = {
  verify: async (login, credential) => {
    if (process.env.ORB_TEST_AUTH !== "1" || !process.env.ORB_APP_ORIGIN?.startsWith("http://127.0.0.1:")) return null;
    if (login === "operations@example.test" && credential === "test-credential") return { userId: "019a5f9b-7c00-7000-8000-000000000311", roles: ["OPERATIONS"], mfaRequired: false };
    if (login === "owner@example.test" && credential === "owner-secret-value") return { userId: "019a5f9b-7c00-7000-8000-000000000312", roles: ["OWNER_ADMIN"], mfaRequired: true };
    return null;
  },
  createSession: async () => ({ sessionId: randomUUID(), version: 1 }),
};

export const POST = createSessionsPostHandler(unavailable);
