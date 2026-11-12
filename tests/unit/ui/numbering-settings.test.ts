import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildNumberingFields,
  prepareNumberingUpdate,
} from "../../../src/ui/features/settings/numbering-settings.ts";

const CURRENT = {
  salesContractPrefix: "SC",
  purchaseContractPrefix: "PC",
  salesShipmentPrefix: "SS",
  supplierContainerPrefix: "CN",
} as const;

test("numbering settings expose every core transaction prefix with bilingual immutable-reference guidance", () => {
  assert.deepEqual(buildNumberingFields("en", CURRENT).map(({ key, label, preview }) => [key, label, preview]), [
    ["salesContractPrefix", "Sales contract", "SC-2026-000001"],
    ["purchaseContractPrefix", "Purchase contract", "PC-2026-000001"],
    ["salesShipmentPrefix", "Sales shipment", "SS-2026-000001"],
    ["supplierContainerPrefix", "Supplier container", "CN-2026-000001"],
  ]);
  assert.deepEqual(buildNumberingFields("ar", CURRENT).map(({ label }) => label), [
    "عقد البيع", "عقد الشراء", "شحنة البيع", "حاوية الموردين",
  ]);
});

test("numbering update normalizes valid prefixes and binds optimistic version plus audit reason", () => {
  assert.deepEqual(prepareNumberingUpdate({
    expectedVersion: 7,
    reason: "Align pilot transaction references",
    values: { ...CURRENT, salesContractPrefix: " orb-sc " },
  }), {
    expectedVersion: 7,
    reason: "Align pilot transaction references",
    patch: { numbering: { ...CURRENT, salesContractPrefix: "ORB-SC" } },
  });
});

test("numbering update fails closed on invalid, duplicate, stale, or unaudited input", () => {
  assert.throws(() => prepareNumberingUpdate({ expectedVersion: 1, reason: "Valid reason", values: { ...CURRENT, salesContractPrefix: "sales contract" } }), /sales contract prefix/i);
  assert.throws(() => prepareNumberingUpdate({ expectedVersion: 1, reason: "Valid reason", values: { ...CURRENT, purchaseContractPrefix: "SC" } }), /unique/i);
  assert.throws(() => prepareNumberingUpdate({ expectedVersion: 0, reason: "Valid reason", values: CURRENT }), /version/i);
  assert.throws(() => prepareNumberingUpdate({ expectedVersion: 1, reason: "short", values: CURRENT }), /reason/i);
});

test("settings page mounts the owner-shaped bilingual numbering editor", () => {
  const page = readFileSync("src/ui/features/settings/SettingsControlCenterPage.tsx", "utf8");
  const panel = readFileSync("src/ui/features/settings/NumberingSettingsPanel.tsx", "utf8");
  assert.match(page, /NumberingSettingsPanel/);
  assert.match(panel, /\/api\/settings/);
  assert.match(panel, /If-Match/);
  assert.match(panel, /Changes apply only to new references/);
  assert.match(panel, /تنطبق التغييرات على المراجع الجديدة فقط/);
  assert.match(panel, /data-operation-id="updateSettings"/);
});
