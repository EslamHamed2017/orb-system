import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  prepareOrganizationPrintUpdate,
  supportedTimeZones,
} from "../../../src/ui/features/settings/organization-print-settings.ts";

const CURRENT = {
  organization: {
    legalNameEn: "ORB Trading",
    legalNameAr: "أورب للتجارة",
    defaultLocale: "en" as const,
    timeZone: "Asia/Dubai",
  },
  print: {
    footerEn: "ORB Trading — Commercial document",
    footerAr: "أورب للتجارة — مستند تجاري",
    showLogo: true,
  },
};

test("organization and print settings expose pilot-safe locale and time-zone choices", () => {
  assert.deepEqual(supportedTimeZones(), ["Asia/Dubai", "UTC"]);
});

test("organization and print update trims bilingual identity and binds version plus audit reason", () => {
  assert.deepEqual(prepareOrganizationPrintUpdate({
    expectedVersion: 4,
    reason: "Align bilingual pilot identity",
    values: {
      organization: { ...CURRENT.organization, legalNameEn: "  ORB Coffee Trading  ", defaultLocale: "ar" },
      print: { ...CURRENT.print, footerAr: "  مستند تجاري معتمد  ", showLogo: false },
    },
  }), {
    expectedVersion: 4,
    reason: "Align bilingual pilot identity",
    patch: {
      organization: { ...CURRENT.organization, legalNameEn: "ORB Coffee Trading", defaultLocale: "ar" },
      print: { ...CURRENT.print, footerAr: "مستند تجاري معتمد", showLogo: false },
    },
  });
});

test("organization and print update fails closed on invalid bilingual, locale, time-zone, version, or audit input", () => {
  assert.throws(() => prepareOrganizationPrintUpdate({ expectedVersion: 1, reason: "Valid reason", values: { ...CURRENT, organization: { ...CURRENT.organization, legalNameAr: "ORB only" } } }), /Arabic legal name/i);
  assert.throws(() => prepareOrganizationPrintUpdate({ expectedVersion: 1, reason: "Valid reason", values: { ...CURRENT, organization: { ...CURRENT.organization, defaultLocale: "fr" as "en" } } }), /default language/i);
  assert.throws(() => prepareOrganizationPrintUpdate({ expectedVersion: 1, reason: "Valid reason", values: { ...CURRENT, organization: { ...CURRENT.organization, timeZone: "Etc/Unknown" } } }), /time zone/i);
  assert.throws(() => prepareOrganizationPrintUpdate({ expectedVersion: 0, reason: "Valid reason", values: CURRENT }), /version/i);
  assert.throws(() => prepareOrganizationPrintUpdate({ expectedVersion: 1, reason: "short", values: CURRENT }), /reason/i);
});

test("settings page mounts owner-shaped organization and print controls", () => {
  const page = readFileSync("src/ui/features/settings/SettingsControlCenterPage.tsx", "utf8");
  const panel = readFileSync("src/ui/features/settings/OrganizationPrintSettingsPanel.tsx", "utf8");
  assert.match(page, /OrganizationPrintSettingsPanel/);
  assert.match(panel, /id="organization"/);
  assert.match(panel, /id="print"/);
  assert.match(panel, /\/api\/settings/);
  assert.match(panel, /If-Match/);
  assert.match(panel, /data-operation-id="updateSettings"/);
  assert.match(panel, /Bilingual identity and print controls/);
  assert.match(panel, /هوية ثنائية اللغة وضوابط الطباعة/);
});
