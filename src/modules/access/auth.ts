import { betterAuth } from "better-auth";
import { randomBytes } from "node:crypto";

export type CredentialVerifier = (login: string, credential: string) => Promise<{ userId: string; roles: readonly string[]; mfaRequired: boolean } | null>;

export function createBetterAuth(options: Parameters<typeof betterAuth>[0]) {
  return betterAuth(options);
}

export function newSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}

export async function verifyCredentialsWithoutIdentityLeak(input: { login: string; credential: string; verify: CredentialVerifier }) {
  if (!input.login.trim() || !input.credential) return null;
  return input.verify(input.login.trim(), input.credential);
}
