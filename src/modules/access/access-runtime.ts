import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createCustomerRequestAuthenticator, hashSessionToken } from "../tenancy/customer-request-context.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaCustomerSessionContextRepository } from "../tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { sessionCsrfToken } from "./session-csrf.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaAccessStore } from "./access-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { AccessProblem, createAccessService, type AccessActor, type AccessService } from "./access-service.ts";

export const SESSION_COOKIE = "__Host-orb_session";
export const CSRF_COOKIE = "__Host-orb_csrf";

export interface AccessRuntime {
  readonly service: AccessService;
  /** The one request authenticator every API route should use. */
  readonly authenticate: (request: Request) => Promise<AccessActor | null>;
}

let runtime: AccessRuntime | undefined;

export function accessRuntime(): AccessRuntime {
  if (runtime) return runtime;
  const prisma = getPrismaClient();
  runtime = Object.freeze({
    service: createAccessService(new PrismaAccessStore(prisma)),
    authenticate: createCustomerRequestAuthenticator(new PrismaCustomerSessionContextRepository(prisma)),
  });
  return runtime;
}

/** Shared authenticator for API routes: resolves the signed-in user, tenant, and roles from the session cookie. */
export function authenticateRequest(request: Request): Promise<AccessActor | null> {
  return accessRuntime().authenticate(request);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

export function sessionTokenHash(request: Request): string | null {
  const token = readCookie(request, SESSION_COOKIE);
  return token ? hashSessionToken(token) : null;
}

function same(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Same-origin + double-submit CSRF check for every state-changing request made with a session cookie. */
export function assertSessionMutation(request: Request): void {
  const allowed = (process.env.ORB_ALLOWED_ORIGINS ?? process.env.ORB_APP_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const origin = request.headers.get("origin");
  if (!origin || !allowed.includes(origin)) throw new AccessProblem(403, "PERMISSION_DENIED", "Request origin is not allowed.");
  const session = readCookie(request, SESSION_COOKIE), cookieToken = readCookie(request, CSRF_COOKIE);
  const expected = session ? sessionCsrfToken(session) : null;
  if (!same(request.headers.get("x-csrf-token"), cookieToken) || !same(cookieToken, expected)) {
    throw new AccessProblem(403, "PERMISSION_DENIED", "Missing or invalid CSRF token.");
  }
}

export function accessProblemResponse(status: number, code: string, detail?: string) {
  return NextResponse.json(
    { type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, ...(detail ? { detail } : {}), correlationId: crypto.randomUUID() },
    { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new AccessProblem(400, "VALIDATION_FAILED", "Request body must be JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessProblem(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

export interface AccessRouteContext {
  readonly actor: AccessActor;
  readonly service: AccessService;
}

/**
 * Wraps an access API handler: authenticates, optionally enforces CSRF, and maps errors to RFC 9457 problems.
 * Unexpected errors never leak details.
 */
export function accessRoute<P>(
  options: { mutation: boolean },
  handler: (request: Request, context: AccessRouteContext, params: P) => Promise<Response>,
  deps: { authenticate?: (request: Request) => Promise<AccessActor | null>; service?: () => AccessService } = {},
) {
  return async (request: Request, route: { params: Promise<P> }) => {
    try {
      const actor = await (deps.authenticate ?? authenticateRequest)(request);
      if (!actor) return accessProblemResponse(401, "AUTHENTICATION_REQUIRED");
      if (options.mutation) assertSessionMutation(request);
      const service = deps.service ? deps.service() : accessRuntime().service;
      return await handler(request, { actor, service }, await route.params);
    } catch (error) {
      if (error instanceof AccessProblem) return accessProblemResponse(error.status, error.code, error.detail);
      if ((error as { code?: string })?.code === "DEPENDENCY_UNAVAILABLE") return accessProblemResponse(503, "DEPENDENCY_UNAVAILABLE");
      console.error("access route failed", error instanceof Error ? error.name : "unknown");
      return accessProblemResponse(500, "INTERNAL_ERROR");
    }
  };
}

export const noStore = { "Cache-Control": "no-store" } as const;

/** Converts AccessProblem (and unexpected errors) thrown inside a route factory's dependencies into problem responses. */
export function mapAccessErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AccessProblem) return accessProblemResponse(error.status, error.code, error.detail);
      if ((error as { code?: string })?.code === "DEPENDENCY_UNAVAILABLE") return accessProblemResponse(503, "DEPENDENCY_UNAVAILABLE");
      console.error("access route failed", error instanceof Error ? error.name : "unknown");
      return accessProblemResponse(500, "INTERNAL_ERROR");
    }
  };
}

/** For route factories without their own authentication step. */
export async function requireActor(request: Request): Promise<AccessActor> {
  const actor = await authenticateRequest(request);
  if (!actor) throw new AccessProblem(401, "AUTHENTICATION_REQUIRED", "Sign in is required.");
  return actor;
}

export const asActor = (principal: unknown) => principal as AccessActor;
