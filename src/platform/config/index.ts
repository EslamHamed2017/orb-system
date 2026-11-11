// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { RuntimeEnvironmentSchema, type RuntimeEnvironment } from "./schema.ts";

export type RuntimeConfig = Readonly<{
  environment: RuntimeEnvironment["NODE_ENV"];
  database: Readonly<{ url: string }>;
  objectStorage: Readonly<{ endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }>;
  http: Readonly<{ appOrigin: string; allowedOrigins: readonly string[] }>;
  auth: Readonly<{ idleMinutes: 30; absoluteMinutes: 720 }>;
  encryption: Readonly<{ key: Uint8Array }>;
  telemetry: Readonly<{ endpoint: string }>;
  backup: Readonly<{ statusEndpoint: string }>;
  realignment: Readonly<{ dualWrite: boolean; readPath: "legacy" | "compare" | "v2" }>;
}>;

function invalid(name: string, detail: string): never {
  throw new Error(`Invalid runtime configuration: ${name} ${detail}`);
}

function url(name: string, value: string, production: boolean, originOnly = false): URL {
  let parsed: URL;
  try { parsed = new URL(value); } catch { invalid(name, "must be an absolute URL"); }
  if (production && parsed.protocol !== "https:") invalid(name, "must use https in production");
  if (parsed.username || parsed.password) invalid(name, "must not contain credentials");
  if (originOnly && (parsed.pathname !== "/" || parsed.search || parsed.hash)) invalid(name, "must be an origin without path, query, or fragment");
  return parsed;
}

function databaseUrl(value: string, production: boolean): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { invalid("DATABASE_URL", "must be an absolute PostgreSQL URL"); }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") invalid("DATABASE_URL", "must use postgresql");
  if (!parsed.hostname || !parsed.pathname.slice(1)) invalid("DATABASE_URL", "must identify a host and database");
  if (production && !["require", "verify-ca", "verify-full"].includes(parsed.searchParams.get("sslmode") || ""))
    invalid("DATABASE_URL", "must require TLS in production");
  return value;
}

function exactInteger(name: string, value: string, expected: number): number {
  if (!/^\d+$/.test(value) || Number(value) !== expected) invalid(name, `must equal ${expected}`);
  return expected;
}

function encryptionKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) invalid("ENCRYPTION_KEY_BASE64", "must be canonical base64");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== value) invalid("ENCRYPTION_KEY_BASE64", "must decode to exactly 32 bytes");
  return bytes;
}

function freezeConfig(config: Omit<RuntimeConfig, "http"> & { http: { appOrigin: string; allowedOrigins: string[] } }): RuntimeConfig {
  Object.freeze(config.database); Object.freeze(config.objectStorage); Object.freeze(config.auth);
  Object.freeze(config.encryption); Object.freeze(config.telemetry); Object.freeze(config.backup); Object.freeze(config.realignment);
  Object.freeze(config.http.allowedOrigins); Object.freeze(config.http);
  return Object.freeze(config);
}

export function parseRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const env = RuntimeEnvironmentSchema.parse(input);
  const production = env.NODE_ENV === "production";
  const appOrigin = url("ORB_APP_ORIGIN", env.ORB_APP_ORIGIN, production, true).origin;
  const allowedOrigins = [...new Set(env.ORB_ALLOWED_ORIGINS.split(",").map((entry) => {
    const value = entry.trim();
    if (!value) invalid("ORB_ALLOWED_ORIGINS", "must not contain blank entries");
    return url("ORB_ALLOWED_ORIGINS", value, production, true).origin;
  }))];
  if (!allowedOrigins.includes(appOrigin)) invalid("ORB_APP_ORIGIN", "must be included in ORB_ALLOWED_ORIGINS");

  const dualWrite = env.ORB_REALIGNMENT_DUAL_WRITE === "1";
  if (env.ORB_REALIGNMENT_READ_PATH !== "legacy" && !dualWrite)
    invalid("ORB_REALIGNMENT_DUAL_WRITE", `must equal 1 before ${env.ORB_REALIGNMENT_READ_PATH} reads`);

  const config = {
    environment: env.NODE_ENV,
    database: { url: databaseUrl(env.DATABASE_URL, production) },
    objectStorage: {
      endpoint: url("OBJECT_STORAGE_ENDPOINT", env.OBJECT_STORAGE_ENDPOINT, production).toString().replace(/\/$/, ""),
      region: env.OBJECT_STORAGE_REGION,
      bucket: env.OBJECT_STORAGE_BUCKET,
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    },
    http: { appOrigin, allowedOrigins },
    auth: {
      idleMinutes: exactInteger("AUTH_IDLE_MINUTES", env.AUTH_IDLE_MINUTES, 30) as 30,
      absoluteMinutes: exactInteger("AUTH_ABSOLUTE_MINUTES", env.AUTH_ABSOLUTE_MINUTES, 720) as 720,
    },
    encryption: { key: encryptionKey(env.ENCRYPTION_KEY_BASE64) },
    telemetry: { endpoint: url("TELEMETRY_ENDPOINT", env.TELEMETRY_ENDPOINT, production).toString().replace(/\/$/, "") },
    backup: { statusEndpoint: url("BACKUP_STATUS_ENDPOINT", env.BACKUP_STATUS_ENDPOINT, production).toString().replace(/\/$/, "") },
    realignment: { dualWrite, readPath: env.ORB_REALIGNMENT_READ_PATH },
  };
  return freezeConfig(config);
}

export function loadRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig(process.env);
}
