import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (no extra dependency).
 *
 * Stored format: scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 * The parameters travel with the hash so they can be raised later without
 * invalidating existing passwords.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 128 * N * R * 2;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: Math.max(MAX_MEMORY, 128 * n * r * 2) }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Returns a human-readable reason when the password is unacceptable, otherwise null. */
export function passwordPolicyViolation(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[A-Za-z؀-ۿ]/.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and digits.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const violation = passwordPolicyViolation(password);
  if (violation) throw new TypeError(violation);
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((value) => Number.isInteger(value) && value > 0)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, salt, n, r, p);
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same CPU time as a real verification so unknown logins
 * cannot be distinguished from wrong passwords by response timing.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-0000");
  await verifyPassword(password, await dummyHash);
  return false;
}
