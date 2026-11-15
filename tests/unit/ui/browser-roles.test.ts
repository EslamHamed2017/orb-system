import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserRole, parseBrowserRoles, replaceBrowserRolePermissions } from "../../../src/modules/access/browser-roles.ts";

const catalog = ["screen.projects", "operation.contracts.approve"] as const;
const input = { code: "CONTRACT_REVIEWER", nameEn: "Contract reviewer", nameAr: "مراجع العقود", descriptionEn: "Reviews contract changes", descriptionAr: "يراجع تغييرات العقود" };

test("creates and reloads one bilingual role without invented user assignments", () => {
  const created = createBrowserRole([], input, catalog, "role-1", "2026-11-15T03:00:00.000Z");
  assert.deepEqual(parseBrowserRoles(JSON.stringify(created), catalog), [{ ...input, id: "role-1", permissionCodes: [], updatedAt: "2026-11-15T03:00:00.000Z" }]);
});

test("rejects duplicate role codes and malformed persisted permissions", () => {
  const roles = createBrowserRole([], input, catalog, "role-1", "2026-11-15T03:00:00.000Z");
  assert.throws(() => createBrowserRole(roles, input, catalog, "role-2", "2026-11-15T03:01:00.000Z"));
  assert.throws(() => parseBrowserRoles(JSON.stringify([{ ...roles[0], permissionCodes: ["unknown.permission"] }]), catalog));
});

test("saves exact permission choices and rejects stale edits", () => {
  const roles = createBrowserRole([], input, catalog, "role-1", "2026-11-15T03:00:00.000Z");
  const saved = replaceBrowserRolePermissions(roles, "role-1", roles[0]!.updatedAt, ["operation.contracts.approve"], catalog, "2026-11-15T03:02:00.000Z");
  assert.deepEqual(saved[0]!.permissionCodes, ["operation.contracts.approve"]);
  assert.throws(() => replaceBrowserRolePermissions(saved, "role-1", roles[0]!.updatedAt, [], catalog, "2026-11-15T03:03:00.000Z"));
});
