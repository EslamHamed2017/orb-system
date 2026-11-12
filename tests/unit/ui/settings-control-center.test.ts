import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSettingsDestinations } from "../../../src/ui/features/settings/settings-control-center.ts";
import { navigationAccessForRole } from "../../../src/ui/navigation/permission-aware-access.ts";

test("settings control center groups approved owner controls with locale-preserving destinations", () => {
  assert.deepEqual(buildSettingsDestinations("en").map(({ key, href }) => [key, href]), [
    ["organization", "/settings?locale=en#organization"],
    ["numbering", "/settings?locale=en#numbering"],
    ["print", "/settings?locale=en#print"],
    ["users", "/admin/users?locale=en"],
    ["roles", "/admin/roles?locale=en"],
    ["backup", "/admin/backup?locale=en"],
  ]);
  assert.deepEqual(buildSettingsDestinations("ar").map(({ label }) => label), [
    "المؤسسة واللغة", "الترقيم والمراجع", "الطباعة والقوالب", "المستخدمون", "الأدوار والصلاحيات", "النسخ الاحتياطي والاستعادة",
  ]);
});

test("settings navigation is owner-only and fails closed", () => {
  assert.equal(navigationAccessForRole("owner-admin", "settings"), true);
  assert.equal(navigationAccessForRole("operations", "settings"), false);
  assert.equal(navigationAccessForRole("finance", "settings"), false);
  assert.equal(navigationAccessForRole("unexpected", "settings"), false);
});

test("settings route is a bilingual control center connected to primary navigation", () => {
  const route = readFileSync("src/app/settings/page.tsx", "utf8");
  const page = readFileSync("src/ui/features/settings/SettingsControlCenterPage.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.match(route, /SettingsControlCenterPage/);
  assert.match(page, /Settings control center/);
  assert.match(page, /مركز التحكم في الإعدادات/);
  assert.match(page, /Organization and language/);
  assert.match(page, /Numbering and references/);
  assert.match(page, /Print and templates/);
  assert.match(page, /data-operation-id="updateSettings"/);
  assert.match(navigation, /href={`\/settings\$\{suffix}`}/);
  assert.match(navigation, /label={label\("Settings", "الإعدادات"\)}/);
});
