import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeConfig } from "../../../src/platform/config/index.ts";
import { createLogRedactor, REDACTED } from "../../../src/platform/logging/redaction.ts";

const VALID_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://orb_app:super-secret-database-password@db.orb.internal:5432/orb?sslmode=verify-full",
  OBJECT_STORAGE_ENDPOINT: "https://objects.orb.internal",
  OBJECT_STORAGE_REGION: "me-central-1",
  OBJECT_STORAGE_BUCKET: "orb-r1-evidence",
  OBJECT_STORAGE_ACCESS_KEY_ID: "ORBACCESS1234567890",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "super-secret-object-storage-key",
  ORB_APP_ORIGIN: "https://orb.example.com",
  ORB_ALLOWED_ORIGINS: "https://orb.example.com,https://admin.orb.example.com",
  AUTH_IDLE_MINUTES: "30",
  AUTH_ABSOLUTE_MINUTES: "720",
  ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
  TELEMETRY_ENDPOINT: "https://telemetry.orb.internal",
  BACKUP_STATUS_ENDPOINT: "https://backup.orb.internal/status",
} as const;

test("validated runtime config parses the fixed R1 security policy", () => {
  const config = parseRuntimeConfig(VALID_ENV);
  assert.equal(config.auth.idleMinutes, 30);
  assert.equal(config.auth.absoluteMinutes, 720);
  assert.deepEqual(config.http.allowedOrigins,
    ["https://orb.example.com", "https://admin.orb.example.com"]);
  assert.equal(config.http.appOrigin, "https://orb.example.com");
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.auth));
});


test("concept realignment rollout defaults to legacy reads with dual writes disabled", () => {
  const config = parseRuntimeConfig(VALID_ENV);
  assert.deepEqual(config.realignment, { dualWrite: false, readPath: "legacy" });
  assert.ok(Object.isFrozen(config.realignment));
});

test("concept realignment cutover requires dual writes and closed flag values", () => {
  const compare = parseRuntimeConfig({
    ...VALID_ENV, ORB_REALIGNMENT_DUAL_WRITE: "1", ORB_REALIGNMENT_READ_PATH: "compare",
  });
  assert.deepEqual(compare.realignment, { dualWrite: true, readPath: "compare" });
  assert.throws(() => parseRuntimeConfig({
    ...VALID_ENV, ORB_REALIGNMENT_READ_PATH: "v2",
  }), /ORB_REALIGNMENT_DUAL_WRITE/);
  assert.throws(() => parseRuntimeConfig({
    ...VALID_ENV, ORB_REALIGNMENT_DUAL_WRITE: "yes",
  }), /ORB_REALIGNMENT_DUAL_WRITE/);
  assert.throws(() => parseRuntimeConfig({
    ...VALID_ENV, ORB_REALIGNMENT_READ_PATH: "new",
  }), /ORB_REALIGNMENT_READ_PATH/);
});

test("runtime parsing ignores unrelated host variables", () => {
  const config = parseRuntimeConfig({ ...VALID_ENV, PATH: "/usr/bin", CI: "true" });
  assert.equal(config.environment, "production");
});

test("production config fails closed on missing or unsafe settings", () => {
  const invalid = [
    ["DATABASE_URL", ""],
    ["DATABASE_URL", "postgresql://orb_app:password@db/orb"],
    ["OBJECT_STORAGE_ENDPOINT", "http://objects.orb.internal"],
    ["ORB_APP_ORIGIN", "http://orb.example.com"],
    ["ORB_ALLOWED_ORIGINS", "http://orb.example.com"],
    ["AUTH_IDLE_MINUTES", "29"],
    ["AUTH_ABSOLUTE_MINUTES", "721"],
    ["ENCRYPTION_KEY_BASE64", Buffer.alloc(16).toString("base64")],
    ["TELEMETRY_ENDPOINT", "http://telemetry.orb.internal"],
    ["BACKUP_STATUS_ENDPOINT", "http://backup.orb.internal"],
  ] as const;
  for (const [key, value] of invalid) {
    assert.throws(() => parseRuntimeConfig({ ...VALID_ENV, [key]: value }), new RegExp(key));
  }
});

test("allowed origins are normalized, unique and must include the app origin", () => {
  const config = parseRuntimeConfig({ ...VALID_ENV, ORB_ALLOWED_ORIGINS: "https://orb.example.com/,https://orb.example.com" });
  assert.deepEqual(config.http.allowedOrigins, ["https://orb.example.com"]);
  assert.throws(() => parseRuntimeConfig({ ...VALID_ENV, ORB_ALLOWED_ORIGINS: "https://admin.orb.example.com" }), /ORB_APP_ORIGIN/);
});

test("log redaction removes secrets and identity payloads without mutating input", () => {
  const redact = createLogRedactor(["runtime-secret-123"]);
  const input = {
    message: "Connection failed for runtime-secret-123",
    authorization: "Bearer token-123",
    user: { id: "user-123", displayName: "Private Person", email: "private@example.com", role: "OPERATIONS" },
    nested: [{ sessionId: "session-123", correlationId: "safe-correlation" }],
    database: { url: "postgresql://orb:database-password@db/orb" },
    encryption: { key: new Uint8Array([1, 2, 3]) },
  };
  const output = redact(input);
  assert.deepEqual(output, {
    message: "Connection failed for [REDACTED]",
    authorization: REDACTED,
    user: REDACTED,
    nested: [{ sessionId: REDACTED, correlationId: "safe-correlation" }],
    database: { url: "postgresql://orb:[REDACTED]@db/orb" },
    encryption: REDACTED,
  });
  assert.equal(input.user.email, "private@example.com");
});

test("log redaction handles circular structures fail closed", () => {
  const cyclic: Record<string, unknown> = {token: "token-123"};
  cyclic.self = cyclic;
  const redact = createLogRedactor();
  assert.deepEqual(redact(cyclic), { token: REDACTED, self: "[CIRCULAR]" });
});
