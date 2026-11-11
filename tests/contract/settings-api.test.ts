import { readFileSync } from "node:fs";
import { parseYaml } from "./openapi-contract.test.ts";
import assert from "node:assert/strict";
import test from "node:test";

const OWNER = { userId: "019a5f9b-7c00-7000-8000-00000000c001", roles: ["OWNER_ADMIN"] };
const INITIAL = {
  organization: { legalNameEn: "ORB Trading", legalNameAr: "أورب للتجارة", defaultLocale: "en", timeZone: "Asia/Dubai" },
  numbering: { salesContractPrefix: "SC", purchaseContractPrefix: "PC", salesShipmentPrefix: "SS", supplierContainerPrefix: "CN" },
  print: { footerEn: "ORB Trading", footerAr: "أورب للتجارة", showLogo: true },
};

test("settings read and update use optimistic versioning and append an immutable audit record", async () => {
  const { createInMemorySettingsService } = await import("../../src/modules/settings/settings-service.ts");
  const service = createInMemorySettingsService({ initial: INITIAL, now: () => "2026-11-11T12:00:00.000Z", id: () => "019a5f9b-7c00-7000-8000-00000000c002" });
  const before = await service.read({ principal: OWNER });
  assert.equal(before.version, 1);
  const updated = await service.update({ principal: OWNER, expectedVersion: 1, reason: "Use the registered bilingual organization name", patch: { organization: { legalNameEn: "ORB Coffee Trading", legalNameAr: "أورب لتجارة القهوة" } } });
  assert.equal(updated.version, 2);
  assert.equal(updated.organization.legalNameEn, "ORB Coffee Trading");
  assert.equal(updated.numbering.salesContractPrefix, "SC");
  const audit = service.listAudit();
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0], { id: "019a5f9b-7c00-7000-8000-00000000c002", action: "SETTINGS_UPDATED", actorId: OWNER.userId, occurredAt: "2026-11-11T12:00:00.000Z", reason: "Use the registered bilingual organization name", beforeVersion: 1, afterVersion: 2, changedSections: ["organization"], before: INITIAL, after: { ...INITIAL, organization: { legalNameEn: "ORB Coffee Trading", legalNameAr: "أورب لتجارة القهوة", defaultLocale: "en", timeZone: "Asia/Dubai" } } });
  assert.throws(() => (audit[0] as any).reason = "tampered", TypeError);
});

test("settings updates are owner-only, validated, secret-free, and reject stale writes", async () => {
  const { createInMemorySettingsService } = await import("../../src/modules/settings/settings-service.ts");
  const service = createInMemorySettingsService({ initial: INITIAL });
  await assert.rejects(() => service.read({ principal: { userId: "ops", roles: ["OPERATIONS"] } }), /Settings access denied/);
  await assert.rejects(() => service.update({ principal: OWNER, expectedVersion: 1, reason: "x", patch: { organization: { legalNameEn: "Changed" } } }), /reason/);
  await assert.rejects(() => service.update({ principal: OWNER, expectedVersion: 1, reason: "valid reason", patch: { organization: { apiKey: "secret" } as any } }), /Unknown settings field/);
  await service.update({ principal: OWNER, expectedVersion: 1, reason: "Update footer", patch: { print: { footerEn: "Updated" } } });
  await assert.rejects(() => service.update({ principal: OWNER, expectedVersion: 1, reason: "Stale update", patch: { print: { footerEn: "Again" } } }), /version conflict/);
});


test("settings HTTP API authenticates owner reads and versioned updates server-side", async () => {
  const route = await import("../../src/app/api/settings/route.ts");
  const calls: any[] = [];
  const handler = route.createSettingsHandlers({
    authenticate: async () => OWNER,
    read: async (input: any) => { calls.push(["read", input]); return { ...INITIAL, version: 1, updatedAt: null, updatedBy: null }; },
    update: async (input: any) => { calls.push(["update", input]); return { ...INITIAL, ...input.patch, version: 2, updatedAt: "2026-11-11T12:00:00.000Z", updatedBy: OWNER.userId }; },
  });
  const readResponse = await handler.GET(new Request("https://orb.example/api/settings"));
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get("cache-control"), "no-store");
  assert.equal(calls[0][1].principal.userId, OWNER.userId);
  const updateResponse = await handler.PATCH(new Request("https://orb.example/api/settings", { method: "PATCH", headers: { "content-type": "application/json", "if-match": '"1"' }, body: JSON.stringify({ reason: "Update print footer", patch: { print: { footerEn: "New footer" } } }) }));
  assert.equal(updateResponse.status, 200);
  assert.equal(calls[1][1].expectedVersion, 1);
  assert.equal(calls[1][1].reason, "Update print footer");
  assert.deepEqual(calls[1][1].patch, { print: { footerEn: "New footer" } });

  let called = false;
  const denied = route.createSettingsHandlers({ authenticate: async () => ({ userId: "ops", roles: ["OPERATIONS"] }), read: async () => { called = true; }, update: async () => { called = true; } });
  assert.equal((await denied.GET(new Request("https://orb.example/api/settings"))).status, 403);
  assert.equal(called, false);
  assert.equal((await handler.PATCH(new Request("https://orb.example/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }))).status, 428);
});


test("settings OpenAPI and additive schema expose owner-only versioned settings with append-only audit", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const path = api.paths["/settings"];
  assert.equal(path.get.operationId, "getSettings");
  assert.equal(path.patch.operationId, "updateSettings");
  assert.deepEqual(path.get["x-required-roles"], ["OWNER_ADMIN"]);
  assert.deepEqual(path.patch["x-required-roles"], ["OWNER_ADMIN"]);
  assert.equal(path.patch.parameters[0].$ref, "#/components/parameters/IfMatch");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model SystemSettings \{/);
  assert.match(schema, /model SettingsAuditEvent \{/);
  const migration = readFileSync("prisma/migrations/202611110034_settings_audit/migration.sql", "utf8");
  assert.match(migration, /SettingsAuditEvent_append_only/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON "SettingsAuditEvent" FROM orb_app/);
});
