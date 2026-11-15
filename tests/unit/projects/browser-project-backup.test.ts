import assert from "node:assert/strict";
import test from "node:test";
import { createProjectRecord, PROJECT_STORAGE_KEY } from "../../../src/modules/projects/daily-projects.ts";
import { createBrowserProjectBackup, parseBrowserProjectBackup } from "../../../src/modules/projects/browser-project-backup.ts";

const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });

test("creates a versioned browser-only backup from validated saved projects", () => {
  const backup = createBrowserProjectBackup(JSON.stringify([project]), "2026-11-15T08:00:00.000Z");
  assert.deepEqual(backup, {
    format: "orb-browser-project-backup",
    version: 1,
    exportedAt: "2026-11-15T08:00:00.000Z",
    storageKey: PROJECT_STORAGE_KEY,
    projects: [project],
  });
  assert.deepEqual(parseBrowserProjectBackup(JSON.stringify(backup)), backup);
});

test("rejects malformed, unknown-version, wrong-scope, and corrupt project backups", () => {
  const good = createBrowserProjectBackup(JSON.stringify([project]), "2026-11-15T08:00:00.000Z");
  for (const value of [
    "not-json", [], null,
    { ...good, format: "other" },
    { ...good, version: 2 },
    { ...good, storageKey: "other-user" },
    { ...good, exportedAt: "yesterday" },
    { ...good, extra: true },
    { ...good, projects: [{ ...project, value: 1 }] },
    { ...good, projects: [{ ...project, unexpected: "hidden" }] },
    { ...good, projects: [{ ...project, supplierShipment: { reference: "SS-1", expectedArrival: "2026-11-15", quantity: "1", unexpected: true }, status: "ACTIVE", supplier: "Coast", purchaseContractReference: "PC-1" }] },
  ]) assert.throws(() => parseBrowserProjectBackup(typeof value === "string" ? value : JSON.stringify(value)), /INVALID_BROWSER_PROJECT_BACKUP/);
});

test("refuses to export corrupt saved data or an invalid timestamp", () => {
  assert.throws(() => createBrowserProjectBackup("not-json", "2026-11-15T08:00:00.000Z"), /INVALID_BROWSER_PROJECT_BACKUP/);
  assert.throws(() => createBrowserProjectBackup(JSON.stringify([project]), "not-a-time"), /INVALID_BROWSER_PROJECT_BACKUP/);
});
