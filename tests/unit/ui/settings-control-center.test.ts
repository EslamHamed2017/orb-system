import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { navigationAccessForRole } from "../../../src/ui/navigation/permission-aware-access.ts";

test("settings navigation is owner-only and fails closed", () => {
  assert.equal(navigationAccessForRole("owner-admin", "settings"), true);
  assert.equal(navigationAccessForRole("operations", "settings"), false);
  assert.equal(navigationAccessForRole("finance", "settings"), false);
  assert.equal(navigationAccessForRole("unexpected", "settings"), false);
});

test("Account and settings edits the real company profile that prints on documents", () => {
  const route = readFileSync("src/app/settings/page.tsx", "utf8");
  const page = readFileSync("src/ui/features/settings/SettingsControlCenterPage.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/qb-navigation.ts", "utf8");
  assert.match(route, /SettingsControlCenterPage/);
  for (const text of ["Account and settings", "الحساب والإعدادات", "Bank details", "Tax registration number (TRN)", "Document design", "Preview an invoice"]) assert.match(page, new RegExp(text.replace(/[()]/g, "\\$&")));
  assert.match(page, /fetch\("\/api\/settings"/);
  assert.match(page, /data-operation-id="updateSettings"/);
  assert.doesNotMatch(page, /ORB Trading/, "no sample company is shown as the real one");
  assert.match(navigation, /href: "\/settings", en: "Account and settings", ar: "الحساب والإعدادات"/);
});
