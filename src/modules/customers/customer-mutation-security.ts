import { timingSafeEqual } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { sessionCsrfToken } from "../access/session-csrf.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { CustomerProblem } from "./customer-service.ts";

const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) { try { return decodeURIComponent(value.join("=")); } catch { return null; } }
  }
  return null;
}
export function customerCsrfToken(sessionToken: string): string {
  return sessionCsrfToken(sessionToken);
}

function equal(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validateCustomerMutationRequest(request: Request): string {
  const expectedOrigin = process.env.ORB_APP_ORIGIN;
  if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin) throw new CustomerProblem("PERMISSION_DENIED", 403);
  const sessionToken = cookie(request, "__Host-orb_session");
  const csrfCookie = cookie(request, "__Host-orb_csrf");
  const expected = sessionToken ? customerCsrfToken(sessionToken) : null;
  if (!equal(request.headers.get("x-csrf-token"), csrfCookie) || !equal(csrfCookie, expected)) throw new CustomerProblem("PERMISSION_DENIED", 403);
  const key = request.headers.get("idempotency-key");
  if (!key || !IDEMPOTENCY_KEY.test(key)) throw new CustomerProblem("VALIDATION_FAILED", 400);
  return key.toLowerCase();
}
