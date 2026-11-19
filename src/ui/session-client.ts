"use client";

/** Browser helpers for calling ORB APIs with the signed-in session. */

export interface CurrentSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly login: string | null;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly locale: "en" | "ar";
  readonly roles: readonly ("OWNER_ADMIN" | "OPERATIONS" | "FINANCE_VIEWER")[];
  readonly mustChangePassword: boolean;
  readonly version: number;
  readonly expiresAt: string;
}

export interface ApiProblem {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
}

export function csrfToken(): string {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "__Host-orb_csrf") return decodeURIComponent(value.join("="));
  }
  return "";
}

/** Headers every state-changing request needs: CSRF token and a fresh idempotency key. */
export function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/json", "x-csrf-token": csrfToken(), "idempotency-key": crypto.randomUUID(), ...extra };
}

export async function problemOf(response: Response): Promise<ApiProblem> {
  try {
    const body = await response.json() as { code?: string; detail?: string };
    return { status: response.status, code: body.code ?? "UNKNOWN", detail: body.detail };
  } catch {
    return { status: response.status, code: "UNKNOWN" };
  }
}

/** Sends a JSON mutation. Resolves to the parsed body (or null for 204); rejects with an ApiProblem. */
export async function sendJson<T = unknown>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T | null> {
  const response = await fetch(url, { method, headers: mutationHeaders(), body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  if (!response.ok) throw await problemOf(response);
  return response.status === 204 ? null : await response.json() as T;
}

export async function fetchCurrentSession(): Promise<CurrentSession | null> {
  const response = await fetch("/api/sessions/current", { cache: "no-store", headers: { accept: "application/json" } });
  if (response.status === 401) return null;
  if (!response.ok) throw await problemOf(response);
  return await response.json() as CurrentSession;
}

export function signInUrl(locale: "en" | "ar"): string {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/sign-in?locale=${locale}&next=${encodeURIComponent(next)}`;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}
